//  TODO: make to be optional to display the debug message
export function debug(...message: any[]): void {
  log('[ QUICK LOFI DEBUG ] >>> ', ...message);
}
