import * as AWS from "aws-sdk";
import * as fs from "fs";
import { integer } from "aws-sdk/clients/cloudfront";
import { PromiseResult } from "aws-sdk/lib/request";

const help = () : void => {
  console.log("Usage: gamelift-ssh {AliasName|FleetId} [region]");
};

/**
 * Rresolve FleetId from alias name
 * @param {AWS.GameLift} gl 
 * @param {string} aliasName 
 * @return {string} FleetId
 */
const resolveFleet = async (gl : AWS.GameLift, aliasName : string) : Promise<string> => {
  let res : PromiseResult<AWS.GameLift.ListAliasesOutput, AWS.AWSError>;

  try {
    res = await gl.listAliases({Name: aliasName}).promise();
  } catch (e) {
    throw new Error(e.message);
  }

  if (res.Aliases.length == 0) {
    throw new Error("alias");
  }
  const alias = res.Aliases[0];
  if (alias.RoutingStrategy.Type != 'SIMPLE') {
    throw new Error('alias has stopped.');
  }

  return alias.RoutingStrategy.FleetId;
}

/**
 * Instance Access Information
 */
interface InstanceAccess {
  IpAddress: string;
  UserName: string;
  Secret: string;
}

/**
 * Get instance access credentials
 * @param {AWS.GameLift} gl 
 * @param {string} fleetId 
 * @param {integer} index 
 */
const getInstanceAccess = async (gl : AWS.GameLift, fleetId : string, index : integer = 0) : Promise<InstanceAccess> => {
  const listRes = await gl.describeInstances({FleetId: fleetId}).promise();
  if (listRes.Instances.length == 0) {
		throw new Error('no instances yet');
  }
  const instance = listRes.Instances[index];

  const res = await gl.getInstanceAccess({
    FleetId: fleetId, InstanceId: instance.InstanceId}).promise();
  const { UserName, Secret } = res.InstanceAccess.Credentials;

  return {
    IpAddress: res.InstanceAccess.IpAddress,
    UserName,
    Secret,
  };
}

/**
 * Write RSA file
 * @param {InstanceAccess} credentials 
 * @param {string} path 
 */
const prepareCredentials = (credentials : InstanceAccess, path : string) => {
  // Line feed is escaped in response JSON
  const data = credentials.Secret.replace('\\n', '\n');
  return new Promise((res, rej) => {
    fs.writeFile(path, data, 'utf-8', (err) => {
      if (err) rej(err);
      else res();
    });
  });
};

const main = async () : Promise<void> => {
  
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    help();
    return;
  }
  const [fleetSpec, region] = argv;

  const gl = new AWS.GameLift({
    region: region || 'ap-northeast-1'
  });

  const fleetId = fleetSpec.startsWith('fleet-') 
    ? fleetSpec : await resolveFleet(gl, fleetSpec);

  const cre = await getInstanceAccess(gl, fleetId);

  const path = './gl_rsa';
  await prepareCredentials(cre, path);

  console.log(`ssh ${cre.UserName}@${cre.IpAddress} -i ${path}`)
};

main();
