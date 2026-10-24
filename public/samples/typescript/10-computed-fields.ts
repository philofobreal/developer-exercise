const trace: string[] = [];
const first = "first";
const second = "second";
class Computed {
  [first] = trace.push("first");
  [second] = trace.push("second");
}
const value = new Computed();
