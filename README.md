# AlphaReality Liveness JS SDK

## Instructions to run the sample app:

- run `npm install`
- on mac and linux run `HTTPS=true npm start` and on windows run `set HTTPS=true&&npm start`. Mobile devices which are connected to the same network can access the app as well.

## Instructions to use the SDK:

### Installation:

- Copy the directory `alpha-liveness-sdk` (included in the sample app) to your to your project outside the `node_modules` directory

- run `npm install /path/to/alpha-liveness-sdk`. This command will add `"alpha-liveness-sdk": "file: /path/to/alpha-liveness-sdk"` to your package.json file and will install necessary dependencies for the sdk in your `node_modules` and re use the ones which already exists.

- Move the `models` directory from `alpha-liveness-sdk/dist` directory to your public directory and the css file either to your public directory or import it in your less/sass/js file. (For your convenience the css file is not minified, modify it as you desire).

- Copy the files inside `node_modules/@tensorflow/tfjs-backend-wasm/wasm-out` path to the `models` directory from the previous step. You can automate the latter two steps using `cpx` which is already an SDK dependency.

### Usage:

- Import the SDK as so:
```
import AlphaLivenessSDK from ‘alpha-liveness-sdk’;
```

- or if you are using it with TS frameworks use require:
```
const AlphaLivenessSDK = require('path-to-the-package');
```

- Get a new instance of the SDK:
```
const sdk = new AlphaLivenessSDK('element-id-to-replace', 'path-to-models-public-directory');
//the path to models directory should end in "/"
//e.g. const sdk = new AlphaLivenessSDK('my-div', '/public/')
```

- To set the consent hint and consent text use the config object of the SDK:
```
sdk.config.consentHint = "Consent Hint";
sdk.config.consentText = "Consent Text";
```

- Setup the elements and get camera access:
```
sdk.setup().then(() => {
	//if everything was ok and the model is loaded correctly start the liveness process
    sdk.start();
});
```

- To listen for the results do as follows (if you are not using typescript remove the argument types):
```
sdk.onLivenessFinished(() => { //is called when the liveness steps is finished by user.
	alert("Liveness Finished!");
});

sdk.onLivenessReady((frontFrame: Blob, livenessClip: Blob) => { //is called when the liveness video Blob is ready
	// do whatever you want with the blob file
	console.log(frontFrame);
	console.log(livenessClip);
});

sdk.onConsentFinished(() => { //is called when the consent steps is finished by user
	alert("Consent Finished!");
})

sdk.onConsentReady((blob: Blob) => { //is called when the consent video Blob is ready
	// do whatever you want with the blob file
	console.log(blob);
});
```

- And finally to release the camera access and remove record button call:
```
sdk.finished();
```