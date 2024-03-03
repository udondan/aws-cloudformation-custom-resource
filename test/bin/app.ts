#!/usr/bin/env node
import cdk = require('aws-cdk-lib');

import { Stack } from '../lib';

const app = new cdk.App();
new Stack(app, 'TestStackCustomCloudformationResource13', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
