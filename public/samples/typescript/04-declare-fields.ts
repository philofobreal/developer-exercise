class Declared {
  declare name: string;
  declare id: number;
  constructor(name: string, id: number) {
    this.name = name;
    this.id = id;
  }
}
const value = new Declared("Ada", 1);
