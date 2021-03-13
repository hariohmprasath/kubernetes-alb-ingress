import * as cdk from '@aws-cdk/core';
import { PetClinicConstruct } from './index';

const app = new cdk.App();
const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const stack = new cdk.Stack(app, 'petclinic-stack', { env });

new PetClinicConstruct(stack, 'PetClinicCluster', {
  uiImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-ui-eks:latest',
  customerImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-customer-eks:latest',
  vetsImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-vets-eks:latest',
  visitsImage: '775492342640.dkr.ecr.us-west-2.amazonaws.com/petclinic-visits-eks:latest',
});
