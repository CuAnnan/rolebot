const   bot = require('./RoleBot.js'),
		Discord = require('discord.js'),
		conf = require('./conf.js'),
		client = new Discord.Client();

bot.init().then(
	function()
	{
		client.login(conf.clientToken);
		
		client.on(
			'ready',
			function () {
				console.log('Logged bot in');
			}
		);
		
		client.on(
			'message',
			function (message) {
				if (message.author.bot)
				{
					return;
				}
				
				bot.process(message);
			}
		);
	}
);

process.on(
	'SIGINT',
	function()
	{
		bot.destroy();
		console.log('Shutting down bot');
		client.destroy();
		console.log('Shutting down app');
		process.exit();
	}
);