import "./App.css";
import "alpha-liveness-sdk/dist/css/alpha-liveness-sdk.css";
import { useState } from "react";

import AlphaLivenessSDK from "alpha-liveness-sdk";
const sdk = new AlphaLivenessSDK("element", "/models/");

sdk.config.consentHint =
  "لطفا پس از فشردن دکمه رکورد متن زیر را بصورت شمرده و با صدای بلند بخوانید";
sdk.config.consentText =
  "من محمد گرانمایه دارنده کد ملی" +
  Math.floor(Math.random() * 1000000000) +
  " تقاضای ارتقا اکانت به سطح طلایی دارم";

sdk.setup().then(() => {
  sdk.start();
});

function App() {
  const [livenessBlob, setLivenessBlob] = useState<Blob>();
  const [consentBlob, setConsentBlob] = useState<Blob>();
  const [frontFrameBlob, setFrontFrameBlob] = useState<Blob>();
  const [showLinks, setShowLinks] = useState(false);
  const [livenessFinished, setLivenessFinished] = useState(false);

  sdk.onLivenessFinished(() => {
    console.log("Liveness Finished!");
    setLivenessFinished(true);
  });

  sdk.onLivenessReady((frontFrame: Blob, livenessClip: Blob) => {
    setLivenessBlob(livenessClip);
    setFrontFrameBlob(frontFrame);
  });

  sdk.onConsentFinished(() => {
    console.log("Consent Finished!");
  });

  sdk.onConsentReady((blob: Blob) => {
    setConsentBlob(blob);
    sdk.finished();
    setShowLinks(true);
  });

  return (
    <div className="App">
      <div id="element"></div>

      <>
        {!livenessFinished && (
          <p className="liveness-hint">
            لطفا سر خود را به آرامی چپ و راست بچرخانید تا تمامی دایره ها سبز
            شوند. <br />
            در صورت لزوم کمی به دوربین نزدیک شوید
          </p>
        )}
      </>

      <div>
        {showLinks && frontFrameBlob && (
          <img alt={"front-frame"} src={URL.createObjectURL(frontFrameBlob)} />
        )}
      </div>
      <div>
        {showLinks && livenessBlob && (
          <a
            target="_b
          "
            href={URL.createObjectURL(livenessBlob)}
          >
            دانلود ویدیو احراز هویت
          </a>
        )}
      </div>
      <div style={{ marginTop: 5 }}>
        {showLinks && consentBlob && (
          <a target="_blank" href={URL.createObjectURL(consentBlob)}>
            دانلود ویدیو خوداظهاری
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
