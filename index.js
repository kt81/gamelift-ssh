#!/usr/bin/env node

const AWS = require('aws-sdk');
const fs = require('fs');

const help = () => {
  console.log("Usage: gamelift-ssh {AliasName|FleetId} [region]");
};

/**
 * Rresolve FleetId from alias name
 * @param {AWS.GameLift} gl 
 * @param {string} aliasName 
 * @return {string} FleetId
 */
const resolveFleet = async (gl, aliasName) => {
	const res = await gl.listAliases({Name: aliasName}).promise();
	if (res.length == 0) {
		throw new Error('alias not found.');
  }
  const alias = res.Aliases[0];
  if (alias.RoutingStrategy.Type != 'SIMPLE') {
		throw new Error('alias has stopped.');
  }

  return alias.RoutingStrategy.FleetId;
}

/**
 * Get instance access credentials
 * @param {AWS.GameLift} gl 
 * @param {string} fleetId 
 * @param {Number} index 
 */
const getInstanceAccess = async (gl, fleetId, index = 0) => {
  let res = await gl.describeInstances({FleetId: fleetId}).promise();
  if (res.Instances.length == 0) {
		throw new Error('no instances yet');
  }
  const instance = res.Instances[index];

  res = await gl.getInstanceAccess({
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
 * @param {*} credentials 
 * @param {string} path 
 */
const prepareCredentials = (credentials, path) => {
  // Line feed is escaped in response JSON
  const data = credentials.Secret.replace('\\n', '\n');
  return new Promise((res, rej) => {
    fs.writeFile(path, data, 'utf-8', (err) => {
      if (err) rej(err);
      else res();
    });
  });
};

const main = async () => {
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
