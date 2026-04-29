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

### Environment variables

In a .env file you can have the following environment variables:

- VITE_CLICK_EXPERIMENT: Set to 'true' if running an image click experiment (pic1.png and pic2.png will be shown for respective user)
- VITE_TYPING_TIMEOUT: Number of milliseconds before 'typing' switches to 'idle'. Defaults to 1200
- USE_PIN:
  - Set to 'true' to randomise a 4-digit pin code that needs to be entered in URL.
  - Set to empty or 'false' to not use a pin code (everyone with the link can access)
  - Set to any other number to use that static pin code / password
- ADMIN_PASSWORD: Password required to access admin.html (leave empty to have it not password protected)
- PORT: The port to run the server on, defaults to 5061

Note that environment variables accessible to frontend needs to be prefixed with 'VITE_'
