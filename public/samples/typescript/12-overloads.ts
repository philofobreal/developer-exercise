interface Service {
  call(value: string): string;
  call(value: number): number;
  name: string;
  id: number;
}
