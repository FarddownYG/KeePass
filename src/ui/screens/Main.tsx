import { useCallback, useEffect, useState } from 'react'
import { Lock, MousePointerClick } from 'lucide-react'
import { groupId, isInRecycleBin, rootGroup } from '../../core/vault'
import { Button } from '../components/Button'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { useDb, useSession } from '../state/session-context'
import { Audit, type AuditResult } from './Audit'
import { EntryDetail } from './EntryDetail'
import { EntryForm } from './EntryForm'
import { EntryList } from './EntryList'
import { GeneratorScreen } from './GeneratorScreen'
import { GroupDialogs } from './GroupDialogs'
import { SettingsScreen } from './Settings'
import { Sidebar } from './Sidebar'
import { findEntry, findGroup, groupDisplayName, selectionEntries } from './vault-utils'
import type { EditorState, GroupAction, GroupSel, Tool } from './view'

export function Main() {
  const db = useDb()
  const { rev, dirty, saving, fileName, save, lock } = useSession()
  const [tool, setTool] = useState<Tool | null>(null)
  const [sel, setSel] = useState<GroupSel>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [drawer, setDrawer] = useState(false)
  const [groupAction, setGroupAction] = useState<GroupAction | null>(null)
  const [lockConfirm, setLockConfirm] = useState(false)
  const [audit, setAudit] = useState<AuditResult | null>(null)

  const root = rootGroup(db)
  const rootId = groupId(root)
  const selGroup = sel === 'all' || sel === 'bin' ? undefined : findGroup(db, sel)
  const effectiveSel: GroupSel = sel === 'all' || sel === 'bin' ? sel : selGroup && !isInRecycleBin(db, selGroup) ? sel : 'all'
  const entries = selectionEntries(db, effectiveSel, query)
  const totalInVault = selectionEntries(db, 'all', '').length
  const selectedEntry = selectedId ? findEntry(db, selectedId) : undefined
  const editingEntry = editor?.kind === 'edit' ? findEntry(db, editor.id) : undefined
  const detailOpen = editor !== null || selectedEntry !== undefined
  const listTitle = effectiveSel === 'all' ? 'Toutes les entrées' : effectiveSel === 'bin' ? 'Corbeille' : selGroup ? groupDisplayName(selGroup) : 'Entrées'
  const vaultName = db.meta.name || root.name || 'Coffre'

  const requestLock = useCallback((): void => {
    if (dirty) setLockConfirm(true)
    else lock()
  }, [dirty, lock])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        void save(e.shiftKey)
      } else if (k === 'l') {
        e.preventDefault()
        requestLock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, requestLock])

  const selectGroup = (g: GroupSel): void => {
    setTool(null)
    setSel(g)
    setQuery('')
    setSelectedId(null)
    setEditor(null)
    setDrawer(false)
  }

  const selectTool = (t: Tool): void => {
    setTool(t)
    setEditor(null)
    setDrawer(false)
  }

  const openEntry = (id: string): void => {
    setTool(null)
    setSel('all')
    setQuery('')
    setEditor(null)
    setSelectedId(id)
  }

  const newEntry = (): void => {
    const groupFor = effectiveSel === 'all' || effectiveSel === 'bin' ? rootId : effectiveSel
    setEditor({ kind: 'new', groupId: groupFor })
  }

  const sidebar = (inDrawer: boolean) => (
    <Sidebar
      db={db}
      rev={rev}
      vaultName={vaultName}
      fileName={fileName}
      dirty={dirty}
      saving={saving}
      sel={effectiveSel}
      tool={tool}
      onSelectGroup={selectGroup}
      onSelectTool={selectTool}
      onGroupAction={(a) => {
        if (inDrawer) setDrawer(false)
        setGroupAction(a)
      }}
      onSave={() => void save()}
      onSaveAs={() => void save(true)}
      onLock={() => {
        setDrawer(false)
        requestLock()
      }}
    />
  )

  let detail
  if (editor) {
    detail = (
      <EntryForm
        key={editor.kind === 'edit' ? editor.id : 'new'}
        db={db}
        entry={editor.kind === 'edit' ? (editingEntry ?? null) : null}
        defaultGroupId={editor.kind === 'new' ? editor.groupId : rootId}
        onClose={(savedId) => {
          setEditor(null)
          if (savedId) setSelectedId(savedId)
        }}
      />
    )
  } else if (selectedEntry) {
    detail = (
      <EntryDetail
        key={selectedId}
        db={db}
        entry={selectedEntry}
        onBack={() => setSelectedId(null)}
        onEdit={() => setEditor({ kind: 'edit', id: selectedEntry.uuid.id })}
        onGone={() => setSelectedId(null)}
      />
    )
  } else {
    detail = (
      <div className="flex h-full items-center bg-bg">
        <EmptyState icon={<MousePointerClick className="size-6" aria-hidden />} title="Aucune entrée sélectionnée">
          Choisissez une entrée dans la liste pour voir ses détails, ou créez-en une nouvelle.
        </EmptyState>
      </div>
    )
  }

  let toolView = null
  if (tool === 'generator') toolView = <GeneratorScreen onBack={() => setTool(null)} />
  else if (tool === 'audit') toolView = <Audit db={db} rev={rev} result={audit} onResult={setAudit} onOpenEntry={openEntry} onBack={() => setTool(null)} />
  else if (tool === 'settings') toolView = <SettingsScreen db={db} onBack={() => setTool(null)} />

  return (
    <div className="h-dvh w-full bg-bg lg:grid lg:grid-cols-[256px_minmax(300px,380px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <aside className="hidden h-full min-h-0 border-r border-line lg:block">{sidebar(false)}</aside>
      {toolView ? (
        <section className="h-full min-h-0 lg:col-span-2" aria-label="Outil">
          {toolView}
        </section>
      ) : (
        <>
          <section className={`h-full min-h-0 border-line lg:border-r ${detailOpen ? 'hidden lg:block' : ''}`} aria-label="Liste des entrées">
            <EntryList
              title={listTitle}
              entries={entries}
              totalInVault={totalInVault}
              query={query}
              onQuery={setQuery}
              selectedId={selectedEntry ? selectedId : null}
              onSelect={(id) => {
                setEditor(null)
                setSelectedId(id)
              }}
              onNew={newEntry}
              canAdd={effectiveSel !== 'bin'}
              isBin={effectiveSel === 'bin'}
              dirty={dirty}
              onSave={() => void save()}
              onLock={requestLock}
              onOpenMenu={() => setDrawer(true)}
            />
          </section>
          <section className={`h-full min-h-0 ${detailOpen ? '' : 'hidden lg:block'}`} aria-label="Détail de l’entrée">
            {detail}
          </section>
        </>
      )}

      <Dialog open={drawer} onClose={() => setDrawer(false)} title="Menu du coffre" variant="drawer">
        {sidebar(true)}
      </Dialog>
      <GroupDialogs db={db} action={groupAction} onClose={() => setGroupAction(null)} />
      <ConfirmDialog
        open={lockConfirm}
        title="Modifications non enregistrées"
        confirmLabel="Verrouiller sans enregistrer"
        danger
        onClose={() => setLockConfirm(false)}
        onConfirm={() => {
          setLockConfirm(false)
          lock()
        }}
        extra={
          <Button
            variant="primary"
            icon={<Lock className="size-4" aria-hidden />}
            onClick={() => {
              setLockConfirm(false)
              void save().then((ok) => {
                if (ok) lock()
              })
            }}
          >
            Enregistrer et verrouiller
          </Button>
        }
      >
        <p>Verrouiller maintenant effacerait les changements non enregistrés de ce coffre.</p>
      </ConfirmDialog>
    </div>
  )
}
