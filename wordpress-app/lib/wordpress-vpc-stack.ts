import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as rds from 'aws-cdk-lib/aws-rds';

export class WordpressvpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //VPC with SSM Param
    const customVpc = new ec2.Vpc(this, 'CustomVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.50.0.0/16'),
      createInternetGateway: true,
    });

    new cdk.CfnOutput(this, 'CustomVPCIDOutput', {
      value: customVpc.vpcId,
      exportName: 'Application-VPC-ID', // optional if you want to share this output across stacks
    });

    const publicSubnets = customVpc.publicSubnets;

    new cdk.CfnOutput(this, 'PublicSubnetID1Output', {
      value: publicSubnets[0].subnetId,
      exportName: 'Public-Subnet1-ID',
    });

    new cdk.CfnOutput(this, 'PublicSubnetID2Output', {
      value: publicSubnets[1].subnetId,
      exportName: 'Public-Subnet2-ID',
    });

    const privateSubnets = customVpc.privateSubnets;

    new cdk.CfnOutput(this, 'PrivateSubnetID1Output', {
      value: privateSubnets[0].subnetId,
      exportName: 'Private-Subnet1-ID',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetID2Output', {
      value: privateSubnets[1].subnetId,
      exportName: 'Private-Subnet2-ID',
    });


    //SG-ALB with SSM Param
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', { 
      vpc: customVpc
    });
    
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4("0.0.0.0/0"),
      ec2.Port.tcp(80)
   )
   albSecurityGroup.addIngressRule(
    ec2.Peer.ipv4("0.0.0.0/0"),
    ec2.Port.tcp(443)
 )

 new cdk.CfnOutput(this, 'ALBSGOutput', {
  value: albSecurityGroup.securityGroupId,
  exportName: 'Application-ALB-SG-ID', // optional if you want to share this output across stacks
});

    //SG-EC2 with SSM Param
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', { 
      vpc: customVpc
    });
    
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.ipv4("0.0.0.0/0"),
      ec2.Port.tcp(22)
   )
   ec2SecurityGroup.addIngressRule(
    albSecurityGroup,
    ec2.Port.tcp(80)
 )
 ec2SecurityGroup.addIngressRule(
  albSecurityGroup,
  ec2.Port.tcp(443)
)
new cdk.CfnOutput(this, 'EC2SGOutput', {
  value: ec2SecurityGroup.securityGroupId,
  exportName: 'Application-EC2-SG-ID', // optional if you want to share this output across stacks
});

    //SG-RDS with SSM Param
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', { 
      vpc: customVpc
    });
    
    rdsSecurityGroup.addIngressRule(
      ec2SecurityGroup,
      ec2.Port.tcp(3306)
   )

   new cdk.CfnOutput(this, 'RDSSGOutput', {
    value: rdsSecurityGroup.securityGroupId,
    exportName: 'Application-RDS', // optional if you want to share this output across stacks
  });

    //SG-Subnet-Group with SSM Param
    
    const rdssubnetGroup = new rds.SubnetGroup(this, 'RDSSubnetGroup', {
      description: 'RDS SubnetGroup',
      vpc: customVpc,
    
      subnetGroupName: 'RDS-SUBNET-GROUP',
      vpcSubnets: {
       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    new cdk.CfnOutput(this, 'RDSSubnetGroupOutput', {
      value: rdssubnetGroup.subnetGroupName,
      exportName: 'Application-RDS-SUBNET-GROUP-NAME', // optional if you want to share this output across stacks
    });
  }
}