# WebChat

WebChat is a simple web-based chat application communicating over WebSockets.

## Background

Previously Chattool was used but it only logs what is actually sent to the server,
and not the process of writing the message and correcting spelling mistakes etc.

To simplify the data collection, this project was developed.

### Local development

Run `npm run dev` to start server and client at the same time. See `npm run` for other options.

If using Firefox, you may need to add a property in `about:config`:

`network.security.ports.banned.override` a string property with the value of `5060,5061`
