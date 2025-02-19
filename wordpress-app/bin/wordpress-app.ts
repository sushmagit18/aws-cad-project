#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { WordpressvpcStack } from '../lib/wordpress-vpc-stack';
import { WordpressAppStack } from '../lib/wordpress-app-stack';

const app = new cdk.App();

const vpcDeployment = true;

const deployment = { "stack" : "A" } 

if (['V'].includes(deployment.stack)) {
    new WordpressvpcStack(app, 'WordpressvpcStack', {
    });
}

if (['A'].includes(deployment.stack)) {
    new WordpressAppStack(app, 'WordpressAppStack', {

  });
}

