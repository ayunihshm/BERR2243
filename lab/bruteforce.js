const bcrypt = require("bcryptjs");

const targetHash = "$2a$05$3pqF8gapjY82H.T4G7LNauba.lObTbsVWsBkAh2jEKl.9kK2l/cHq";
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

function* generateCombos(length, prefix = "") {
  if (length === 0) yield prefix;
  else {
    for (let char of chars) {
      yield* generateCombos(length - 1, prefix + char);
    }
  }
}

(async () => {
  for (let len = 1; len <= 4; len++) {
    for (let combo of generateCombos(len)) {
      const match = await bcrypt.compare(combo, targetHash);
      if (match) {
        console.log("✅ Password found:", combo);
        return;
      }
    }
  }
  console.log("❌ No password found in tested range.");
})();
