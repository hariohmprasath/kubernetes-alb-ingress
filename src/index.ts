import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as iam from '@aws-cdk/aws-iam';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';

// Customizable construct inputs
export interface IPetClinicConstruct {

  // UI Image
  readonly uiImage: string;

  // Customer Image
  readonly customerImage: string;

  // Vets Images
  readonly vetsImage: string;

  // Visits Image
  readonly visitsImage: string;
}

export class PetClinicConstruct extends cdk.Construct {
  readonly namespace: string = 'petclinic-namespace';

  constructor(scope: cdk.Construct, id: string, props: IPetClinicConstruct) {
    super(scope, id);

    // VPC
    const vpc = new ec2.Vpc(this, 'Vpc', { natGateways: 1 });

    // Custom security group
    const securityGroup = new ec2.SecurityGroup(this, 'ecs-security-group', {
      vpc: vpc,
      allowAllOutbound: true,
    });

    // Allow inbound port 3306 (Mysql), 80 (Load balancer)
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306), 'Port 3306 for inbound traffic from IPv4');
    securityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(3306), 'Port 3306 for inbound traffic from IPv6');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Port 80 for inbound traffic from IPv4');
    securityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), 'Port 80 for inbound traffic from IPv6');

    // EKS Cluster
    const cluster = new eks.Cluster(this, 'ekscluster', {
      clusterName: 'Cluster',
      vpc: vpc,
      version: eks.KubernetesVersion.V1_18,
      outputClusterName: true,
      outputConfigCommand: true,
      outputMastersRoleArn: true,
      securityGroup: securityGroup,
      defaultCapacity: 0,
    });

    const nodeRole = new iam.Role(this, 'nodeRole', {
      roleName: 'nodeRole',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'));
    nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'));
    nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'));
    nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSFullAccess'));
    nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'));
    nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'));

    // Add NodeGroup
    new eks.Nodegroup(this, 'eksNodeGroup', {
      cluster: cluster,
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      instanceTypes: [new ec2.InstanceType('m5a.large')],
      minSize: 2,
      maxSize: 3,
      nodeRole: nodeRole,
    });

    /*
        Since worker nodes are in a private subnet - an sts vpc endpoint is required.
        We will give it access to the Security Group for the Control Plane
    */
    new ec2.InterfaceVpcEndpoint(this, 'stsendpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.STS,
      vpc: vpc,
      open: true,
      securityGroups: [
        securityGroup,
      ],
    });

    cluster.addHelmChart('albIngressControllerChart', {
      chart: 'aws-load-balancer-controller',
      namespace: this.namespace,
      repository: 'https://aws.github.io/eks-charts',
      values: {
        clusterName: cluster.clusterName,
        serviceAccount: {
          create: false,
          name: this.createServiceAccount(cluster).serviceAccount.serviceAccountName,
        },
      },
    });

    // RDS Aurora MySQL (with data API enabled)
    const db = new rds.ServerlessCluster(this, 'Db', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      vpc: cluster.vpc,
      enableDataApi: true,
      securityGroups: [securityGroup],
      scaling: {
        minCapacity: rds.AuroraCapacityUnit.ACU_8,
        maxCapacity: rds.AuroraCapacityUnit.ACU_32,
      },
      credentials: rds.Credentials.fromGeneratedSecret('syscdk'),
    });

    // Create namespace
    const namespace = this.createNameSpace(cluster);

    // UI Service
    this.createService(cluster, 'ui', db, props.uiImage, namespace);

    // Customer service
    this.createService(cluster, 'customer', db, props.customerImage, namespace);

    // Vets service
    this.createService(cluster, 'vets', db, props.vetsImage, namespace);

    // Visits service
    this.createService(cluster, 'visits', db, props.visitsImage, namespace);

    // Create Ingress
    this.createIngress(cluster);
  }

  /*
    Here we are adding policy statements to the Aws-Load-Balancer-Controller's Role(which is created with the Service Account)
    Policies Added from https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/main/docs/install/iam_policy.json
  */
  createServiceAccount(cluster: eks.Cluster) {

    // Creating it via CDK will create the OpenIdentity Provider Connection automatically
    // Adding the Service Account to an object so that it can be referenced across other methods in the class
    const serviceAccount = {
      serviceAccount: new eks.ServiceAccount(this, 'awsloadbalancersa', {
        name: 'aws-load-balancer-controller',
        namespace: this.namespace,
        cluster: cluster,
      }),
    };

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:CreateServiceLinkedRole',
        'ec2:DescribeAccountAttributes',
        'ec2:DescribeAddresses',
        'ec2:DescribeInternetGateways',
        'ec2:DescribeVpcs',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeInstances',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeTags',
        'elasticloadbalancing:DescribeLoadBalancers',
        'elasticloadbalancing:DescribeLoadBalancerAttributes',
        'elasticloadbalancing:DescribeListeners',
        'elasticloadbalancing:DescribeListenerCertificates',
        'elasticloadbalancing:DescribeSSLPolicies',
        'elasticloadbalancing:DescribeRules',
        'elasticloadbalancing:DescribeTargetGroups',
        'elasticloadbalancing:DescribeTargetGroupAttributes',
        'elasticloadbalancing:DescribeTargetHealth',
        'elasticloadbalancing:DescribeTags',
      ],
      resources: ['*'],
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:DescribeUserPoolClient',
        'acm:ListCertificates',
        'acm:DescribeCertificate',
        'iam:ListServerCertificates',
        'iam:GetServerCertificate',
        'waf-regional:GetWebACL',
        'waf-regional:GetWebACLForResource',
        'waf-regional:AssociateWebACL',
        'waf-regional:DisassociateWebACL',
        'wafv2:GetWebACL',
        'wafv2:GetWebACLForResource',
        'wafv2:AssociateWebACL',
        'wafv2:DisassociateWebACL',
        'shield:GetSubscriptionState',
        'shield:DescribeProtection',
        'shield:CreateProtection',
        'shield:DeleteProtection',
      ],
      resources: ['*'],
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:AuthorizeSecurityGroupIngress',
        'ec2:RevokeSecurityGroupIngress',
        'ec2:AuthorizeSecurityGroupEgress',
        'ec2:RevokeSecurityGroupEgress',
      ],
      resources: ['*'],
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:CreateSecurityGroup',
      ],
      resources: ['*'],
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:CreateTags',
      ],
      resources: ['arn:aws:ec2:*:*:security-group/*'],
      conditions: {
        StringEquals: {
          'ec2:CreateAction': 'CreateSecurityGroup',
        },
        Null: {
          'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
        },
      },
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:CreateTags',
        'ec2:DeleteTags',
      ],
      resources: ['arn:aws:ec2:*:*:security-group/*'],
      conditions: {
        Null: {
          'aws:RequestTag/elbv2.k8s.aws/cluster': 'true',
          'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
        },
      },
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:AuthorizeSecurityGroupIngress',
        'ec2:RevokeSecurityGroupIngress',
        'ec2:DeleteSecurityGroup',
      ],
      resources: ['*'],
      conditions: {
        Null: {
          'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
        },
      },
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticloadbalancing:CreateLoadBalancer',
        'elasticloadbalancing:CreateTargetGroup',
      ],
      resources: ['*'],
      conditions: {
        Null: {
          'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
        },
      },
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticloadbalancing:CreateListener',
        'elasticloadbalancing:DeleteListener',
        'elasticloadbalancing:CreateRule',
        'elasticloadbalancing:DeleteRule',
      ],
      resources: ['*'],
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticloadbalancing:AddTags',
        'elasticloadbalancing:RemoveTags',
      ],
      resources: ['arn:aws:elasticloadbalancing:*:*:loadbalancer/*',
        'arn:aws:elasticloadbalancing:*:*:targetgroup/*'],
      conditions: {
        Null: {
          'aws:RequestTag/elbv2.k8s.aws/cluster': 'true',
          'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
        },
      },
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticloadbalancing:ModifyLoadBalancerAttributes',
        'elasticloadbalancing:SetIpAddressType',
        'elasticloadbalancing:SetSecurityGroups',
        'elasticloadbalancing:SetSubnets',
        'elasticloadbalancing:DeleteLoadBalancer',
        'elasticloadbalancing:ModifyTargetGroup',
        'elasticloadbalancing:ModifyTargetGroupAttributes',
        'elasticloadbalancing:RegisterTargets',
        'elasticloadbalancing:DeregisterTargets',
        'elasticloadbalancing:DeleteTargetGroup',
      ],
      resources: ['*'],
      conditions: {
        Null: {
          'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
        },
      },
    }));

    serviceAccount.serviceAccount.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticloadbalancing:SetWebAcl',
        'elasticloadbalancing:ModifyListener',
        'elasticloadbalancing:AddListenerCertificates',
        'elasticloadbalancing:RemoveListenerCertificates',
        'elasticloadbalancing:ModifyRule',
      ],
      resources: ['*'],
    }));

    return serviceAccount;
  }

  // Create namespace
  createNameSpace(cluster: eks.Cluster): eks.KubernetesManifest {
    return cluster.addManifest('namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: this.namespace,
      },
    });
  }

  // Create ingress with path based routing
  createIngress(cluster: eks.Cluster) {
    cluster.addManifest('petclinic-ingress', {
      apiVersion: 'extensions/v1beta1',
      kind: 'Ingress',
      metadata: {
        namespace: 'petclinic-namespace',
        name: 'petclinic-ingress',
        annotations: {
          'kubernetes.io/ingress.class': 'alb',
          'alb.ingress.kubernetes.io/scheme': 'internet-facing',
          'alb.ingress.kubernetes.io/healthcheck-port': '80',
          'alb.ingress.kubernetes.io/healthcheck-path': '/actuator/health',
          'alb.ingress.kubernetes.io/healthcheck-protocol': 'HTTP',
          'alb.ingress.kubernetes.io/target-type': 'ip',
        },
      },
      spec: {
        rules: [
          {
            http: {
              paths: [
                {
                  path: '/owners*',
                  backend: {
                    serviceName: 'petclinic-customer-service',
                    servicePort: 80,
                  },
                },
                {
                  path: '/vets*',
                  backend: {
                    serviceName: 'petclinic-vets-service',
                    servicePort: 80,
                  },
                },
                {
                  path: '/visits*',
                  backend: {
                    serviceName: 'petclinic-visits-service',
                    servicePort: 80,
                  },
                },
                {
                  path: '/*',
                  backend: {
                    serviceName: 'petclinic-ui-service',
                    servicePort: 80,
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }

  // Create deployment and service
  createService(
    cluster: eks.Cluster,
    suffix: string,
    db: rds.ServerlessCluster,
    image: string, namespace: eks.KubernetesManifest,
  ) : void {

    // K8s Deployment
    const deployment = cluster.addManifest('deployment-' + suffix, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'petclinic-' + suffix,
        namespace: this.namespace,
      },
      spec: {
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'petclinic-' + suffix,
          },
        },
        replicas: 1,
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'petclinic-' + suffix,
            },
          },
          spec: {
            containers: [
              {
                image: image,
                imagePullPolicy: 'Always',
                name: 'petclinic-' + suffix,
                securityContext: {
                  runAsUser: 0,
                },
                ports: [
                  {
                    containerPort: 80,
                    protocol: 'TCP',
                  },
                ],
                env: [
                  {
                    name: 'SECRETS_NAME',
                    value: db.secret?.secretName,
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/actuator/health',
                    port: 80,
                  },
                },
              },
            ],
          },
        },
      },
    });
    deployment.node.addDependency(namespace);

    // K8s Service
    const service = cluster.addManifest('service-' + suffix, {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        namespace: this.namespace,
        name: 'petclinic-' + suffix + '-service',
      },
      spec: {
        ports: [
          {
            port: 80,
            targetPort: 80,
            protocol: 'TCP',
          },
        ],
        type: 'NodePort',
        selector: {
          'app.kubernetes.io/name': 'petclinic-' + suffix,
        },
      },
    });

    // Dependency
    service.node.addDependency(namespace);
  }
}