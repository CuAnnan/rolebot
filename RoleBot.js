'use strict';
const   conf = require('./conf.js');

let RoleBot = {
		electiveRoles: {},
		initialised: false,
		mongo: null,
		exposedMethods: {}
	};

function elevate(member)
{
	if(!(
		member.roles.exists('name', conf.roles.mod) || member.roles.exists('name', conf.roles.admin) ||
		member.roles.exists('name', '@'+conf.roles.mod) || member.roles.exists('name', '@'+conf.roles.admin)
	))
	{
		throw {
			name:'permissionFailedException',
			message:member.user.username+' tried an elevated role thing',
			toString:function(){return this.message}
		};
	}
}

RoleBot.addElectiveRole = function(commandArguments, message, comment)
{
	elevate(message.member);
	let roles = this._parseRoles(message);
	for(let role of roles)
	{
		if(!this.findRole(message, role))
		{
			message.guild.createRole({name: role}).then();
		}
	}
	
	this.addElectiveRolesToDatabase(message.guild.id, roles).then(
		()=>{
			message.channel.send('BEEP BOOP\nAdded elected roles '+roles.join(', ')+' to this server');
		}
	).catch(
		(error)=>{
			console.log(error);
		}
	)
};

RoleBot.findRole = function(message, name)
{
	console.log('Trying to find role '+name);
	return message.guild.roles.find('name', name);
};

RoleBot._parseRoles = function(message)
{
	let roleTags = message.cleanContent.match(/(@[\w\ ]+)/g);
	console.log(roleTags);
	let roleNames = [];
	for(let i = 0; i < roleTags.length; i++)
	{
		let roleTag = roleTags[i].substring(1);
		let roleName = roleTag.charAt(0).toUpperCase() + roleTag.substring(1);
		roleNames.push(roleName);
	}
	return roleNames;
}

RoleBot.addElectiveRolesToDatabase = function(guildID, roles)
{
	return this.collection.updateOne(
		{guildID:guildID},
		{
			$addToSet:{
				roles:{$each:roles}
			}
		},
		{upsert:true}
	);
};

RoleBot.listRoles = function(commandArguments, message, comment)
{
	this._getElectiveRoles(message.guild.id).then(
		(response)=>{
			message.channel.send('BEEP BOOP\nAvailable elective roles: '+response.roles.join(', '));
		}
	);
	
};

RoleBot.dropRoles = function(commandArguments, message, comment)
{
	elevate(message.member);
	let roles = this._parseRoles(message);
	for(let roleName of roles)
	{
		let role = this.findRole(message, roleName);
		role.delete();
	}
	this._dropRoles(message.guild.id, roles).then(
		()=>{
			message.channel.send('BEEP BOOP\nRoles '+roles.join(', ')+' dropped');
		}
	);
};

RoleBot._dropRoles = function(guildID, roles)
{
	return this.collection.updateOne(
		{guildID:guildID},
		{$pull:{roles:{$in:roles}}}
	);
}

RoleBot.unelectRoles = function(commandArguments, message, comment)
{
	this._getElectiveRoles(message.guild.id).then((result)=>{
		let electableRoles = result.roles,
			electedRoles = this._parseRoles(message);
		for(let electedRole of electedRoles)
		{
			if(electableRoles.indexOf(electedRole) >= 0)
			{
				let role = this.findRole(message, electedRole);
				if(role)
				{
					message.member.removeRole(role).then(
						()=>
						{
							console.author(mesage.author.username+' tried to dropped role '+electedRole);
						}
					).catch(
						(err)=>
						{
							console.log(err);
						}
					);
				}
				else
				{
					console.warn(message.author.username+' tried to add a nonexistant role '+electedRole+' to their roles');
				}
			}
			else
			{
				console.warn(message.author.username+' tried to add a non elective role '+electedRole+' to their roles');
			}
		}
	});
};

RoleBot.electRole = function(commandArguments, message, comment)
{
	
	this._getElectiveRoles(message.guild.id).then((result)=>{
		let electableRoles = result.roles,
			electedRoles = this._parseRoles(message);
		console.log(electableRoles);
		for(let electedRole of electedRoles)
		{
			if(electableRoles.indexOf(electedRole) >= 0)
			{
				let role = this.findRole(message, electedRole);
				if(role)
				{
					console.log('Trying to add role '+electedRole+' to '+message.author.username);
					message.member.addRole(role).then(
						()=>{
							console.log('Added role '+electedRole+' to '+message.author.username);
						}
					).catch(
						(err)=>{
							console.log(err);
						}
					);
					
				}
				else
				{
					console.warn(message.author.username+' tried to add a nonexistant role '+electedRole+' to their roles');
				}
			}
			else
			{
				console.warn(message.author.username+' tried to add a non elective role '+electedRole+' to their roles');
			}
		}
	});
};

RoleBot._getElectiveRoles = function(guildID)
{
	return this.collection.findOne({guildID: guildID});
};

RoleBot.process = function(message)
{
	// only process commands
	if(!message.content.startsWith(conf.commandPrefix))
	{
		return;
	}
	// don't process "private" methods
	if(message.content.startsWith(conf.commandPrefix+'_'))
	{
		return;
	}
	// don't allow dms
	if(message.channel.type == 'dm')
	{
		message.channel.send("You cannot use this bot via DM yet for technical reasons");
		return;
	}
	
	/**
	 * A command is given in the form
	 * !command argument argument argument -- some comment
	 */
	let args = message.content.substring(1).split('--'),
		comment = args[1]?args[1].trim():'',
		commandArguments = args[0].toLowerCase().split(' '),
		command = commandArguments.shift(),
		commandsToIgnore = ['process', 'init', 'destruct'],
		method = this.exposedMethods[command];
	console.log('Should be processing command');
	
	if(!method)
	{
		return;
	}
	try
	{
		this[method](commandArguments, message, comment);
	}
	catch(e)
	{
		console.log(e);
	}
};

RoleBot.help = function(commandArguments, message, comment)
{
	message.channel.send([
			'BEEP BOOP',
			'Role bot commands:',
			'*addRole: Adds an elective role to the set*',
			'electRole: Adds a role to your account',
			'listRoles: Shows a list of all elective roles available',
			'*dropRole: Drops a role from the elective set*',
			'unelect: Removes a role from your account',
			'rolehelp: Shows this text',
			'Italic commands require the @Mod role'
	]);
}

RoleBot.init = function()
{
	let self = this;
	this.exposedMethods = {
		'addrole':'addElectiveRole',
		'addroles':'addElectiveRole',
		'electrole':'electRole',
		'elect':'electRole',
		'electroles':'electRole',
		'listroles':'listRoles',
		'droprole':'dropRoles',
		'droproles':'dropRoles',
		'unelect':'unelectRoles',
		'unelectrole':'unelectRoles',
		'unelectroles':'unelectRoles',
		'rolehelp':'help',
		'roleshelp':'help'
	};
	
	return new Promise(
		(resolve, reject)=>
		{
			let MongoClient = require('mongodb').MongoClient;
			MongoClient.connect(
				conf.mongoURL,
				function(err, db)
				{
					if(err)
					{
						reject(err);
					}
					console.log('Hoisted mongo instance');
					self.mongo = db;
					self.collection = db.collection(conf.mongoCollection);
					resolve('Success');
				}
			)
		}
	);
};

RoleBot.destroy = function()
{
	if(this.mongo)
	{
		console.log('Closed mongo instance');
		this.mongo.close();
	}
}

module.exports = RoleBot;