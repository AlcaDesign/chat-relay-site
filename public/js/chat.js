const app = new Vue({
	el: '#app',
	mounted() {
		const socket = io();
		socket.on('message', e => this.onMessage(e));
		this.getHistory();
	},
	data() {
		return {
			messages: []
		};
	},
	methods: {
		async getHistory() {
			const res = await fetch('/api/history');
			const data = await res.json();
			data.history.forEach(this.onMessage);
		},
		/**
		 * 
		 * @param {{ tags: import('tmi.js').ChatUserstate }} param0 
		 */
		onMessage({ channel, tags, message, self }) {
			const parts = [
				{ type: 'text', content: message } 
			];
			if(tags.emotes) {
				const messageText = Array.from(message);
				const { emotes } = tags;
				const emoteList = [];
				for(const [ id, indicies ] of Object.entries(emotes)) {
					for(const item of indicies) {
						const spl = item.split('-');
						const start = +spl[0];
						const end = +spl[1] + 1;
						const name = messageText.slice(start, end).join('');
						emoteList.push({
							type: 'emote', vendor: 'twitch',
							isEmote: true,
							id, name, start, end,
							url: `url('https://static-cdn.jtvnw.net/emoticons/v1/${id}/2.0')`
						});
					}
				}
				emoteList.sort((a, b) => a.start - b.start);
				parts.splice(0);
				if(emoteList[0].start !== 0) {
					parts.push({
						type: 'text',
						content: messageText.slice(0, emoteList[0].start).join('')
					});
				}
				for(let i = 0; i < emoteList.length; i++) {
					const emote = emoteList[i];
					parts.push(emote);
					const nextEmote = emoteList[i + 1] || {};
					const endContent = messageText.slice(emote.end, nextEmote.start);
					if(endContent.length) {
						parts.push({
							type: 'text',
							content: endContent.join('')
						});
					}
				}
			}
			const username = tags.username;
			const displayName = tags['display-name'];
			tags.name = displayName;
			if(displayName.toLowerCase() !== username) {
				tags.name = `${displayName} (${username})`;
			}
			this.messages.push({ tags, parts });
			if(this.messages.length > 100) {
				this.messages.shift();
			}
		}
	}
});