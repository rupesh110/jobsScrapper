import { loginLinkedIn } from './saveLinkedInProfile.js';

(async () => {
  await loginLinkedIn(false); // set true for headless
})();
