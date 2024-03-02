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

//,
export interface LambdaProperties {
  [key: string]: String;
}

export class Stack extends CdkStack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const stack = CdkStack.of(this);
    const lambdaName = `${stack.stackName}-Test`;

    const fn = new aws_lambda_nodejs.NodejsFunction(this, lambdaName, {
      entry: path.join(__dirname, '../lambda/index.ts'),
      functionName: lambdaName,
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      description: 'Testing custom CFN resources',
      logRetention: 30,
      timeout: Duration.seconds(30),
    });

    fn.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/TestResource1`,
        ],
      }),
    );

    const resourceProperties: LambdaProperties = {
      Name: 'TestResource1', // if set, this will be the physical resource ID
      Value: 'someValue1',
    };
    const queryProps: CustomResourceProps = {
      serviceToken: fn.functionArn,
      resourceType: 'Custom::Test-Resource',
      properties: resourceProperties,
    };

    const customResource = new CustomResource(
      this,
      'TestResource1',
      queryProps,
    );

    const parameterVersion = customResource.getAttString('ParameterVersion');

    new CfnOutput(this, 'ParameterVersion', {
      value: parameterVersion,
    });
  }
}
