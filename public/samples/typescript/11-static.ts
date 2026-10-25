const trace: string[] = [];
class StaticOrder {
  static first = trace.push("first");
  static { trace.push("block"); }
  static second = trace.push("second");
}
