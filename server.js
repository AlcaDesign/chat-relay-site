const tmi = require('tmi.js');
const express = require('express');
const app = express();
const server = app.listen(8050, () => {
	const addr = server.address();
	if(typeof addr !== 'string') {
		console.log(`Listening http://localhost:${addr.port}`);
	}
});
const io = require('socket.io')(server);

app.disable('x-powered-by');

const history = [];

app.use(express.static('public', { extensions: [ 'html' ] }));

app.get('/api/history', (req, res) => {
	res.send({ history });
});

/** @type {tmi.Client} */
const client = new tmi.Client({
	channels: [ 'alca' ],
	options: { debug: true }
});

client.connect();

client.on('message', (channel, tags, message, self) => {
	const msg = { channel, tags, message, self };
	io.emit('message', msg);
	history.push(msg);
	if(history.length > 10) {
		history.shift();
	}
});

io.on('connection', () => console.log('Connected'));