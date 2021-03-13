# PetClinic

Reference application built and deploying following all the best practices highlighted in "Microservices using containers (ECS)" offering

> Note: The application is based on the Github fork https://github.com/spring-petclinic/spring-petclinic-microservices modified to get deployed in ECS ecosystem by removing services like Zuel, Eureka and Circuit breaker, etc.

## Architecture

Here is how “Petclinic” application gets deployed in the ECS ecosystem

![architecture](images/M2MContainer-Architecture.png)


## CI/CD Pipeline

The pipeline takes care of the following:

1. In Source step, it pulls application code from code repository
2. In build step, it performs below steps parallel :
    2.1. Its build's application containers and push them to individual AWS ECR repos
    2.2. It uses CDK tool to build and synthesize application to create a CloudFormation stack template for the AWS ECS Fargate cluster

3. In Deploy step, it deploys application CloudFormation stack which was created earlier in above step.

###  Deployment Steps

- In this section, will walk through CDK steps for application infrastructure and CI/CD deployment.

- AWS Cloud Development Kit [CDK](https://aws.amazon.com/cdk/) is a open source tool which use for development, build and deployment of AWS components. 

- If you are new to CDK you can try out this [CDK workshop](https://cdkworkshop.com/).

### Pre deployment steps

1. Create repository (e.g. petclinic-code ) in AWS Code commit

2. Push your GitLab application code to above created code commit repo so it would act as Source for CI/CD pipeline.

3. Clone code commit repo

```bash
git clone <REPO_NAME>
```
4. Install package dependencies and compile typescript files

```bash
cd cdk
npm ci
npm run watch
```

### Deploy AWS Infrastructure - VPC, ECS and RDS Clusters

```bash
$cd cdk

$cdk list     # List all CDK stacks
PetclinicDevCluster
PetclinicDevPipelineStack
PetclinicDevAppStack
PetclinicRdsStack

$cdk deploy PetclinicDevCluster  # It deploys VPC and ECS cluster

$cdk deploy PetclinicRdsStack # It deploys Aurora Serverless MySQL cluster
```

Once deployment of all stacks completed. You can check, using here:

- Cloudformation Stacks : https://console.aws.amazon.com/cloudformation/home#/stacks

- ECS Cluster : https://console.aws.amazon.com/ecs/home#/clusters

- Aurora Database : https://us-west-2.console.aws.amazon.com/rds/home?region=us-west-2#databases:

### Deployment of Petclinic CI/CD Pipeline

Deploy CI/CD pipeline using 

```bash
cdk deploy PetclinicDevPipelineStack
```

Once above CDK stacks deployed it will :
1. Create ECR repos
2. Build application docker images
3. Once docker images completed successfully it would push them into respective ECR repos
4. It would use CDK synth to create a CloudFormation template for the **PetclinicDevPipelineStack**
5. If it synthesized correctly, it would deploy that application CloudFormation stack.

You can check all AWS resources here: 

- Pipeline: https://console.aws.amazon.com/codesuite/codepipeline/pipelines

- ECR repos: https://console.aws.amazon.com/ecr/repositories

- SSM Image Tag parameter: https://console.aws.amazon.com/systems-manager/parameters

- CloudFormation stacks: https://console.aws.amazon.com/cloudformation/home#/stacks

After deployment of **PetclinicDevPipelineStack** you can find DNS entry of application load balancer in **Outputs** tab.

### Application Bootstrap: 

Send PUT request using curl or postman tool. It would cerate and update database tables with required user information.

```bash
$curl -X PUT http://<DNS-of-Load-Balancer>/owners/boostrap/ 
```

Navigate to that DNS entry in your browser to verify the Petclinic application functionality.


### Verify CI/CD Pipeline 

To verify Petclinic ECS CI/CD workflow, you can try with some changes to README.md file, commit and push changes to master branch and verify that pipeline starts running and deploys your changes:

```
git checkout master
cd petclinic-code/
# DO SOME CHANGES TO README.md 
git commit -am "Changing some text"
git push 
```

Go to Code Pipeline and wait for the Source action to start pulling your changes:

https://console.aws.amazon.com/codesuite/codepipeline/pipelines


### Cleaning up

The created AWS resources, incur cost so don't forget to clean up those resources by running cdk destroy on the stacks. Cost is mainly for the Aurora Cluster, ECS Fargate tasks, the load balancers and the VPC NAT gateways. To delete everything run the following

```
cdk destroy PetclinicDevPipelineStack
cdk destroy PetclinicDevCluster
cdk destroy PetclinicRdsStack
```

## Useful CDK commands

 * `npm run build`    #compile typescript to js
 * `npm run watch`    #watch for changes and compile
 * `cdk deploy`       #deploy this stack to your default AWS account/region
 * `cdk diff`         #compare deployed stack with current state
 * `cdk synth`        #emits the synthesized CloudFormation template

## FAQ

If you code build frequently, your build may fail with below error: 

```
toomanyrequests: You have reached your pull rate limit. You may increase the limit by authenticating and upgrading: https://www.docker.com/increase-rate-limit

```
You can wait and retry failed steps after sometime or you can try this possible [solution](https://computingforgeeks.com/resolve-docker-pull-rate-limit-aws-error/)
