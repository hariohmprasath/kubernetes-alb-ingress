const { AwsCdkConstructLibrary } = require('projen');

const project = new AwsCdkConstructLibrary({
  author: 'Hari Ohm Prasath',
  authorAddress: 'hariohmprasath@gmail.com',
  cdkVersion: '1.73.0',
  defaultReleaseBranch: 'main',
  jsiiFqn: 'projen.AwsCdkConstructLibrary',
  name: 'ingress-pattern-eks',
  repositoryUrl: 'git@ssh.gitlab.aws.dev:am3-app-modernization-gsp/eks/alb-ingress-petclinic.git',
  cdkDependencies: [
    '@aws-cdk/core',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-eks',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-applicationautoscaling',
    '@aws-cdk/aws-cloudwatch',
    '@aws-cdk/aws-elasticloadbalancingv2',
    '@aws-cdk/aws-eks',
    '@aws-cdk/aws-rds',
  ],
  gitignore: [
    'cdk.out',
    '.DS_Store',
    'yarn.lock',
    '.idea',
  ],
});

project.synth();
