declare const __DEV__: boolean;
export function debug(...message: any[]): void {
  if (__DEV__) {
    log('[ QUICK LOFI DEBUG ] >>> ', ...message);
  }
}
