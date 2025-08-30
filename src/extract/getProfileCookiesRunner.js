import { loginLinkedIn } from './linkedin/saveLinkedInProfile.js';
import {loginGmail} from './gmail/saveGmailProfile.js'

(async () => {
  await loginLinkedIn(false); // set true for headless
})();

// (async () => {
//   await loginGmail(false); // set true for headless
// })();
