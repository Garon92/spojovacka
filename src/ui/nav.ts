export interface Nav {
  /** navigate to a hash route; force = re-run even when the hash does not change */
  go(hash: string, force?: boolean): void;
}
