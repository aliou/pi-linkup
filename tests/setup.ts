import { beforeEach } from "vitest";
import { __resetLinkupSetupForTests } from "../src/setup";

beforeEach(() => {
  process.env.LINKUP_API_KEY = "dummy-linkup-test-key";
  __resetLinkupSetupForTests();
});
