import { CfnOutput, Stack as CdkStack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Parameter } from './parameter';

export class Stack extends CdkStack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const parameterName = 'CustomResourceTestParameter';

    const parameter = new Parameter(this, parameterName, {
      name: parameterName,
      value: new Date().toISOString(),
    });

    Tags.of(parameter).add('some-tag', 'some-value');

    new CfnOutput(this, 'ParameterVersion', {
      value: parameter.parameterVersion,
    });
  }
}
