import * as cdk from '@aws-cdk/core';
import { PetClinicConstruct } from './index';

const app = new cdk.App();
const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const stack = new cdk.Stack(app, 'petclinic-stack', { env });

new PetClinicConstruct(stack, 'PetClinicCluster');
