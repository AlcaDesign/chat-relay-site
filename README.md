# Twitch Chat Relay Site

This server hosts a connection to a Twitch chat channel and relays those messages over a WebSocket to a front-end client for rendering. This is not a Twitch Messaging Interface (TMI) connection proxy service.

Temporarily available at [chat.alca.tv](https://chat.alca.tv) until it's replaced with a new, shinier service.

# Contributing

Contributions are welcome

# TODO

- Cheermotes
- Local sign-in (implicit token)
- Settings (localstorage)
- Display timestamps
- Clear history by timestamp not index
- Other events
	- Moderation
	- Subscriptions
		- New, resub, gift subs
	- Redemptions
		- `msg-id: "highlighted-message"`
		- `msg-id: "skip-subs-mode-message"`
		- `custom-reward-id: "f71d9c13-5cdc-4baa-9d5b-7d9c4b0c1696"`
- Write more of the TODO