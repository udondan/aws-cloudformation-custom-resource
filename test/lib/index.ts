import {
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  CfnOutput,
  CustomResource,
  CustomResourceProps,
  Duration,
  Stack as CdkStack,
  StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');
import { ResourceProperties } from '../lambda';

export class Stack extends CdkStack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const stack = CdkStack.of(this);
    const lambdaName = `${stack.stackName}-Test`;
    const resourceId = 'CustomResourceTestParameter';

    const fn = new aws_lambda_nodejs.NodejsFunction(this, lambdaName, {
      entry: path.join(__dirname, '../lambda/index.ts'),
      functionName: lambdaName,
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      description: 'Testing custom CFN resources',
      logRetention: 3,
      timeout: Duration.seconds(30),
    });

    fn.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/${resourceId}`,
        ],
      }),
    );

    const resourceProperties: ResourceProperties = {
      name: resourceId, // if set, this will be the physical resource ID
      value: new Date().toISOString(), // for testing purpose, we always want to update the parameter
    };

    const queryProps: CustomResourceProps = {
      serviceToken: fn.functionArn,
      resourceType: 'Custom::Test-Resource',
      properties: resourceProperties,
    };

    const customResource = new CustomResource(this, resourceId, queryProps);

    const parameterVersion = customResource.getAttString('ParameterVersion');
    new CfnOutput(this, 'ParameterVersion', {
      value: parameterVersion,
    });
  }
}
