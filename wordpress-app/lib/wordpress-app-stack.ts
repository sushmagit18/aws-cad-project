import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { aws_autoscaling as autoscaling } from 'aws-cdk-lib';
//import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';

export class WordpressAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //CDK for RDS Instance
    const wordpressRDS = new rds.CfnDBInstance(this, "WordpressRDS", {
      dbInstanceIdentifier: "wordpress-db",
      engine: "mysql",
      engineVersion: '8.0.40',
      dbInstanceClass: "db.t3.micro", 
      allocatedStorage: "20", 
      masterUsername: "admin", 
      masterUserPassword: "Metro123456", 
      dbSubnetGroupName: cdk.Fn.importValue('Application-RDS-SUBNET-GROUP-NAME'),
      vpcSecurityGroups:[cdk.Fn.importValue('Application-RDS')],
      publiclyAccessible: false,
      backupRetentionPeriod: 7,
      multiAz: false,
      dbName: "metrodb" 
    });
    new cdk.CfnOutput(this, "RDSInstanceEndpoint", {
      value: wordpressRDS.attrEndpointAddress,
    });

    

    //ALB Load Balancer
    const wordpressALB = new elbv2.CfnLoadBalancer(this, 'WordpressALB', /* all optional props */ {
      ipAddressType: 'ipv4',
      scheme: 'internet-facing',
      name: 'Wordpress-ALB',
      securityGroups: [cdk.Fn.importValue("Application-ALB-SG-ID")],
      subnets: [cdk.Fn.importValue("Public-Subnet1-ID"), cdk.Fn.importValue("Public-Subnet2-ID")],
      type: 'application',
    });
    new cdk.CfnOutput(this, "ALBDNSName", {
      value: wordpressALB.attrDnsName,
      exportName: "Wordpress-ALB-DNS"
    });
    //Target Group
    const cfnTargetGroup = new elbv2.CfnTargetGroup(this, 'MyCfnTargetGroup', /* all optional props */ {
      healthCheckEnabled: true,
      healthCheckPath: '/healthy.html',
      healthCheckPort: '80',
      healthCheckProtocol: 'HTTP',
      name: 'Wordpress-ALB-TG',
      port: 80,
      protocol: 'HTTP',
      targetType: 'instance',
      vpcId: cdk.Fn.importValue("Application-VPC-ID"),
      });

    //listener
    const cfnListener = new elbv2.CfnListener(this, 'MyCfnListener', {
      defaultActions: [{
        type: 'forward',
        targetGroupArn: cfnTargetGroup.attrTargetGroupArn,
      }],
      loadBalancerArn: wordpressALB.attrLoadBalancerArn,
      port: 80,
      protocol: 'HTTP',
      
    });

    //Launch Template with Userdata
    const dbname = "metrodb";
    const password = "Metro123456";
    const username = "admin";
    const hostname = wordpressRDS.attrEndpointAddress;

    const EC2UserData = `
      #!/bin/bash
      echo "Running custom user data script"
      amazon-linux-extras enable php7.4
      sudo yum install -y php php-cli php-fpm php-mysqlnd php-xml php-mbstring php-curl php-zip
      yum install httpd php-mysql -y
      yum update -y
      cd /var/www/html
      echo "healthy" > healthy.html
      wget https://wordpress.org/wordpress-6.7.1.tar.gz
      tar -xzf wordpress-6.7.1.tar.gz
      cp -r wordpress/* /var/www/html/
      rm -rf wordpress
      rm -rf wordpress-6.7.1.tar.gz
      chmod -R 755 wp-content
      chown -R apache:apache wp-content
      mv wp-config-sample.php wp-config.php
      sed -i 's/database_name_here/${dbname}/g' wp-config.php
      sed -i 's/username_here/${username}/g' wp-config.php
      sed -i 's/password_here/${password}/g' wp-config.php
      sed -i 's/localhost/${hostname}/g' wp-config.php
      service httpd start
      chkconfig httpd on
    `;

    const ec2LaunchTemplate = new ec2.CfnLaunchTemplate(this, 'EC2LaunchTemplate', {
      // launchTemplateName: "Wordpress-Launch-Template",
      versionDescription: "v1",
      launchTemplateData: {
        instanceType: 't2.micro',
        imageId: "ami-0f214d1b3d031dc53",
        userData: cdk.Fn.base64(EC2UserData),
        securityGroupIds: [cdk.Fn.importValue("Application-EC2-SG-ID")],
      },
    });

    ec2LaunchTemplate.node.addDependency(wordpressRDS);

    //AUTOSCALING GROUP
    const cfnAutoScalingGroup = new autoscaling.CfnAutoScalingGroup(this, 'MyCfnAutoScalingGroup', {
      maxSize: '20',
      minSize: '2',
      autoScalingGroupName: 'Wordpress-ASG',
      desiredCapacity: '2',
      healthCheckType: 'EC2',
      launchTemplate: {
        version: ec2LaunchTemplate.attrLatestVersionNumber,
        launchTemplateId: ec2LaunchTemplate.attrLaunchTemplateId,
      },
      targetGroupArns: [cfnTargetGroup.attrTargetGroupArn],
      vpcZoneIdentifier: [cdk.Fn.importValue("Private-Subnet1-ID"), cdk.Fn.importValue("Private-Subnet2-ID")],
    });

    const cfnScalingPolicy = new autoscaling.CfnScalingPolicy(this, 'MyCfnScalingPolicy', {
      autoScalingGroupName: cfnAutoScalingGroup.ref,
      policyType: 'TargetTrackingScaling',
      targetTrackingConfiguration: {
        targetValue: 60,
        disableScaleIn: false,
        predefinedMetricSpecification: {
          predefinedMetricType: 'ASGAverageCPUUtilization',
        },
      },
    });

    
  }
}
    
