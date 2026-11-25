export type Tool = 'generator' | 'audit' | 'settings'
/** 'all' | 'bin' | group uuid */
export type GroupSel = string
export type EditorState = { kind: 'new'; groupId: string } | { kind: 'edit'; id: string } | null

export type GroupAction =
  | { kind: 'create'; parentId: string }
  | { kind: 'rename'; id: string }
  | { kind: 'delete'; id: string }
