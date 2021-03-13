import * as cdk from '@aws-cdk/core';
import { PetClinicConstruct } from '../src';
import '@aws-cdk/assert/jest';

test('create app', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app);
  new PetClinicConstruct(stack, 'PetClinicConstruct', {
    uiImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-ui-eks:latest',
    customerImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-customer-eks:latest',
    vetsImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-vets-eks:latest',
    visitsImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-visits-eks:latest',
  });
  expect(stack).toHaveResource('Custom::AWSCDK-EKS-KubernetesResource');
  expect(stack).toHaveResource('Custom::AWSCDKOpenIdConnectProvider');
  expect(stack).toHaveResource('AWS::IAM::Policy');
  expect(stack).toHaveResource('AWS::IAM::Role');
  expect(stack).toHaveResource('Custom::AWSCDK-EKS-HelmChart');
  expect(stack).toHaveResource('AWS::EKS::Nodegroup');
  expect(stack).toHaveResource('AWS::EC2::SecurityGroup');
  expect(stack).toHaveResource('AWS::SecretsManager::Secret');
  expect(stack).toHaveResource('AWS::RDS::DBCluster');
});
