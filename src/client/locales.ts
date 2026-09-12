/**
 * Overlay and settings card copy. English is the source of truth; every other
 * dictionary mirrors it key for key.
 *
 * `zh` and `en` are the locales the shell ships, so they register together as
 * the typed `Record<BuiltInLocaleId, …>` form. The rest are language-pack
 * locales: `dsh-catppuccin` (or whichever pack the profile carries) owns the
 * DEFINITION that makes them selectable, and this plugin only contributes its
 * own namespace to each. It deliberately does not call `addLanguage` — that
 * would throw against an existing definition, and declaring a language this
 * plugin barely translates would put a mostly-English entry in the picker.
 *
 * Typing each dictionary as `Record<MessagesKey, string>` is what keeps the set
 * honest: a key added to `MessagesKey` fails to compile here until all seven
 * translations exist, so no locale can silently fall back to English for a key
 * that was simply forgotten.
 */

/**
 * The namespace every string in this file is registered under.
 *
 * Declared here rather than in `client/index.ts` because the components need it
 * too: `PropsLocale<typeof NS>` is how a slot entry types the `t` seat the
 * framework hands it, and that type has to name the same namespace the
 * registration declares.
 */
export const NS = 'sessionMessages'

/** One dictionary key of the session-messages plugin (overlay + settings card). */
export type MessagesKey =
  | 'title'
  | 'empty'
  | 'closeLabel'
  | 'count'
  | 'sessionTime'
  | 'sessionUsage'
  | 'sessionCacheHit'
  | 'turnUsage'
  | 'turnDuration'
  | 'modelUnknown'
  | 'searchPlaceholder'
  | 'searchAction'
  | 'searchClear'
  | 'searchCount'
  | 'searchNone'
  | 'searchMore'
  | 'hintSearch'
  | 'numberThousand'
  | 'numberMillion'
  | 'durationSeconds'
  | 'durationMinutes'
  | 'hintPick'
  | 'hintWheelUp'
  | 'hintWheelDown'
  | 'hintPage'
  | 'hintJump'
  | 'hintClose'
  | 'settingsTitle'
  | 'settingsDescription'
  | 'expand'
  | 'collapse'
  | 'unsaved'
  | 'readOnly'
  | 'fieldKey'
  | 'fieldKeyHint'
  | 'fieldCtrl'
  | 'fieldAlt'
  | 'fieldShift'
  | 'fieldMeta'
  | 'fieldWheelUp'
  | 'fieldWheelDown'
  | 'fieldMaxRows'
  | 'fieldMaxRowsHint'
  | 'fieldShowHud'
  | 'overridden'
  | 'reset'
  | 'invalidKey'
  | 'invalidMaxRows'
  | 'save'
  | 'discard'
  | 'saving'
  | 'saveFailed'
  | 'unavailable'

const en: Record<MessagesKey, string> = {
  title: 'Messages in this session',
  empty: 'No messages yet.',
  closeLabel: 'Close',
  count: '{count} loaded',
  sessionTime: 'Time {duration}',
  sessionUsage: 'Usage {total}',
  sessionCacheHit: 'Cache hit {percent}%',
  // The per-turn pair. The plugin scrapes only the NUMBER out of the host's tail
  // pills and supplies the label itself: the shell ships zh and en alone, so
  // under any language-pack locale the host's own pill label falls back to
  // English (`Usage 1.06k tok` inside a Japanese UI). English here reproduces
  // what the host renders, so an English UI is unchanged.
  turnUsage: 'Usage {value}',
  turnDuration: 'Ran for {value}',
  // Shown when a turn's own model cannot be read (its events sit outside the
  // loaded window). Deliberately NOT the session's current selection: that is a
  // different fact, and printing it beside an older message states something
  // false with the same confidence as the truth.
  modelUnknown: 'Unknown model',
  // Search. The corpus is the loaded window, not the whole log — the host exposes
  // no in-session search to a client plugin (see `search.ts`) — so the count is
  // phrased as a share of what IS loaded rather than as a bare total.
  searchPlaceholder: 'Search messages',
  searchAction: 'Search',
  searchClear: 'Clear search',
  // Invariant wording, like `count`: the registry carries no plural rules, so
  // "1 of 1 match" has to be avoided by phrasing rather than by inflection.
  searchCount: 'Matched {matches} of {count}',
  searchNone: 'No matching messages',
  // Names the gesture, because the gesture is the whole affordance: with no hit
  // on screen, a second Enter widens the corpus by one page.
  searchMore: 'Press Enter to search further back',
  hintSearch: 'search',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds}s',
  durationMinutes: '{minutes}m{seconds}s',
  hintPick: 'select',
  hintWheelUp: 'up: previous · down: next',
  hintWheelDown: 'up: next · down: previous',
  hintPage: 'page',
  hintJump: 'jump',
  hintClose: 'close',
  settingsTitle: 'Session messages',
  settingsDescription: 'Keyboard shortcut, list size and viewport strip for the in-session message overlay.',
  expand: 'Expand',
  collapse: 'Collapse',
  unsaved: 'Unsaved',
  readOnly: 'The settings document of this deployment is read-only.',
  fieldKey: 'Chord key',
  fieldKeyHint: 'The single KeyboardEvent.key character that opens the overlay. Case-insensitive.',
  fieldCtrl: 'Require Control',
  fieldAlt: 'Require Option / Alt',
  fieldShift: 'Require Shift',
  fieldMeta: 'Require Command / Meta',
  fieldWheelUp: 'Scroll up selects the previous row',
  fieldWheelDown: 'Scroll up selects the next row',
  fieldMaxRows: 'Maximum rows',
  fieldMaxRowsHint: 'Cap on the number of messages listed in the overlay.',
  fieldShowHud: 'Show the viewport strip',
  overridden: 'Overridden',
  reset: 'Reset',
  invalidKey: 'The chord key must be a single character.',
  invalidMaxRows: 'Max rows must be a positive integer.',
  save: 'Save',
  discard: 'Discard',
  saving: 'Saving…',
  saveFailed: 'Save was rejected. Fix the highlighted field and try again.',
  unavailable: 'The session-messages configuration is not available to this page.',
}

const zh: Record<MessagesKey, string> = {
  title: '本会话的消息',
  empty: '还没有消息',
  closeLabel: '关闭',
  count: '已加载 {count} 条',
  sessionTime: '用时 {duration}',
  sessionUsage: '用量 {total}',
  sessionCacheHit: '缓存命中 {percent}%',
  turnUsage: '用量 {value}',
  turnDuration: '用时 {value}',
  modelUnknown: '未知模型',
  searchPlaceholder: '搜索消息',
  searchAction: '搜索',
  searchClear: '清除搜索',
  searchCount: '匹配 {matches} / 共 {count} 条',
  searchNone: '没有匹配的消息',
  searchMore: '按 Enter 在更早的消息中继续搜索',
  hintSearch: '搜索',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds}秒',
  durationMinutes: '{minutes}分{seconds}秒',
  hintPick: '选择',
  hintWheelUp: '向上：上一条 · 向下：下一条',
  hintWheelDown: '向上：下一条 · 向下：上一条',
  hintPage: '翻页',
  hintJump: '跳转',
  hintClose: '关闭',
  settingsTitle: '会话消息',
  settingsDescription: '弹窗式消息跳转的快捷键、列表大小和视口浮条。',
  expand: '展开',
  collapse: '收起',
  unsaved: '未保存',
  readOnly: '本部署的设置文档是只读的。',
  fieldKey: '唤出键',
  fieldKeyHint: '打开弹窗的 KeyboardEvent.key 单字符；大小写不敏感。',
  fieldCtrl: '需要 Ctrl',
  fieldAlt: '需要 Option / Alt',
  fieldShift: '需要 Shift',
  fieldMeta: '需要 Command / Meta',
  fieldWheelUp: '向上滚动选择上一条',
  fieldWheelDown: '向上滚动选择下一条',
  fieldMaxRows: '最大行数',
  fieldMaxRowsHint: '弹窗列表能展示多少条消息的上限。',
  fieldShowHud: '显示视口浮条',
  overridden: '已覆盖',
  reset: '重置',
  invalidKey: '唤出键必须是单个字符。',
  invalidMaxRows: '最大行数必须是正整数。',
  save: '保存',
  discard: '放弃',
  saving: '保存中…',
  saveFailed: '保存被拒。修正高亮字段后重试。',
  unavailable: '本页面无法访问会话消息的配置。',
}

const ja: Record<MessagesKey, string> = {
  title: 'このセッションのメッセージ',
  empty: 'まだメッセージがありません',
  closeLabel: '閉じる',
  count: '{count} 件読み込み済み',
  sessionTime: '所要時間 {duration}',
  sessionUsage: '使用量 {total}',
  // Names the METRIC, not just the object: a bare `キャッシュ 99.2%` reads as
  // "cache 99.2%" with no head noun saying WHAT about the cache. Every language
  // uses its own standard short term for the hit rate. Width matters here — the
  // label rides a nowrap capsule in the viewport strip, so its length decides how
  // much room the message gets — but terminology wins over a few pixels.
  sessionCacheHit: 'キャッシュ率 {percent}%',
  // Same labels as the session pair above, and deliberately so: the number a row
  // carries IS that turn's share of the same two costs, so a reader who has just
  // read `所要時間 56分54秒` in the header should meet the same two words on the
  // rows rather than a second pair of synonyms.
  turnUsage: '使用量 {value}',
  turnDuration: '所要時間 {value}',
  modelUnknown: '不明なモデル',
  searchPlaceholder: 'メッセージを検索',
  searchAction: '検索',
  searchClear: '検索をクリア',
  searchCount: '{count} 件中 {matches} 件が一致',
  searchNone: '一致するメッセージはありません',
  searchMore: 'Enter でさらに前を検索',
  hintSearch: '検索',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds}秒',
  durationMinutes: '{minutes}分{seconds}秒',
  hintPick: '選択',
  hintWheelUp: '上：前へ · 下：次へ',
  hintWheelDown: '上：次へ · 下：前へ',
  hintPage: 'ページ',
  hintJump: 'ジャンプ',
  hintClose: '閉じる',
  // `セッション内メッセージ` rather than a `セッションメッセージ` compound: the
  // latter is a coinage, and this form matches the description right below it.
  settingsTitle: 'セッション内メッセージ',
  settingsDescription: 'セッション内メッセージ一覧のショートカット、表示件数、ビューポートバーを設定します。',
  expand: '展開',
  // `折りたたみ`, not `折りたたむ`: the pair labels two states of one disclosure,
  // so both sides are nouns. A verb on one and a noun on the other reads unevenly.
  collapse: '折りたたみ',
  unsaved: '未保存',
  readOnly: 'この環境の設定ドキュメントは読み取り専用です。',
  fieldKey: '呼び出しキー',
  fieldKeyHint: 'オーバーレイを開く KeyboardEvent.key の 1 文字。大文字小文字は区別しません。',
  // `〜必須` is the idiomatic switch label; `〜を要求` reads as a request for the
  // key rather than as "this modifier is required".
  fieldCtrl: 'Ctrl 必須',
  fieldAlt: 'Option / Alt 必須',
  fieldShift: 'Shift 必須',
  fieldMeta: 'Command / Meta 必須',
  fieldWheelUp: '上スクロールで前の行を選択',
  fieldWheelDown: '上スクロールで次の行を選択',
  fieldMaxRows: '最大行数',
  fieldMaxRowsHint: 'オーバーレイに表示するメッセージ数の上限。',
  fieldShowHud: 'ビューポートバーを表示',
  overridden: '上書き済み',
  reset: 'リセット',
  invalidKey: '呼び出しキーは 1 文字である必要があります。',
  invalidMaxRows: '最大行数は正の整数である必要があります。',
  save: '保存',
  discard: '破棄',
  saving: '保存中…',
  // `ハイライトされた項目`, not `強調された項目`: 強調 describes emphasis in prose,
  // while the referent here is a field the form has marked in the UI.
  saveFailed: '保存が拒否されました。ハイライトされた項目を修正して再試行してください。',
  unavailable: 'このページではセッション内メッセージの設定を利用できません。',
}

const ko: Record<MessagesKey, string> = {
  title: '이 세션의 메시지',
  empty: '아직 메시지가 없습니다',
  closeLabel: '닫기',
  count: '{count}개 로드됨',
  sessionTime: '소요 시간 {duration}',
  sessionUsage: '사용량 {total}',
  // Names the METRIC (`적중률` = hit rate), matching the Japanese note above.
  sessionCacheHit: '캐시 적중률 {percent}%',
  // Same labels as the session pair above — see the Japanese note.
  turnUsage: '사용량 {value}',
  turnDuration: '소요 시간 {value}',
  modelUnknown: '알 수 없는 모델',
  searchPlaceholder: '메시지 검색',
  searchAction: '검색',
  searchClear: '검색 지우기',
  searchCount: '{count}개 중 {matches}개 일치',
  searchNone: '일치하는 메시지가 없습니다',
  searchMore: 'Enter를 눌러 이전 메시지에서 계속 검색',
  hintSearch: '검색',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds}초',
  durationMinutes: '{minutes}분 {seconds}초',
  hintPick: '선택',
  hintWheelUp: '위: 이전 · 아래: 다음',
  hintWheelDown: '위: 다음 · 아래: 이전',
  hintPage: '페이지',
  hintJump: '이동',
  hintClose: '닫기',
  settingsTitle: '세션 메시지',
  settingsDescription: '세션 내 메시지 오버레이의 단축키, 목록 크기, 뷰포트 바.',
  expand: '펼치기',
  collapse: '접기',
  // `저장되지 않음`, not the colloquial `저장 안 됨`: the badge sits in a settings
  // header, where the written register is expected.
  unsaved: '저장되지 않음',
  readOnly: '이 배포의 설정 문서는 읽기 전용입니다.',
  fieldKey: '호출 키',
  fieldKeyHint: '오버레이를 여는 KeyboardEvent.key 단일 문자입니다. 대소문자를 구분하지 않습니다.',
  fieldCtrl: 'Ctrl 필요',
  fieldAlt: 'Option / Alt 필요',
  fieldShift: 'Shift 필요',
  fieldMeta: 'Command / Meta 필요',
  fieldWheelUp: '위로 스크롤하면 이전 행 선택',
  fieldWheelDown: '위로 스크롤하면 다음 행 선택',
  fieldMaxRows: '최대 행 수',
  fieldMaxRowsHint: '오버레이에 표시할 메시지 수 상한.',
  fieldShowHud: '뷰포트 바 표시',
  overridden: '재정의됨',
  reset: '초기화',
  invalidKey: '호출 키는 한 글자여야 합니다.',
  invalidMaxRows: '최대 행 수는 양의 정수여야 합니다.',
  save: '저장',
  discard: '취소',
  saving: '저장 중…',
  // `강조 표시된` (highlighted) rather than `강조된` (emphasised): the referent is
  // a field the form has marked, which is the same distinction the Japanese
  // entry draws between 強調 and ハイライト.
  saveFailed: '저장이 거부되었습니다. 강조 표시된 항목을 수정한 뒤 다시 시도하세요.',
  unavailable: '이 페이지에서는 세션 메시지 설정을 사용할 수 없습니다.',
}

const es: Record<MessagesKey, string> = {
  title: 'Mensajes de esta sesión',
  empty: 'Aún no hay mensajes',
  closeLabel: 'Cerrar',
  // Label-first: the registry carries no plural rules, so `{count} cargados`
  // would read "1 cargados". A bare label does not agree with anything.
  count: 'Cargados: {count}',
  sessionTime: 'Tiempo {duration}',
  sessionUsage: 'Uso {total}',
  // The standard term — see the Japanese entry above for why the bare noun was
  // not good enough.
  sessionCacheHit: 'Aciertos de caché {percent}%',
  // Same labels as the session pair above — see the Japanese note.
  turnUsage: 'Uso {value}',
  turnDuration: 'Tiempo {value}',
  modelUnknown: 'Modelo desconocido',
  searchPlaceholder: 'Buscar mensajes',
  searchAction: 'Buscar',
  searchClear: 'Borrar la búsqueda',
  searchCount: 'Coincidencias: {matches} de {count}',
  searchNone: 'No hay mensajes coincidentes',
  searchMore: 'Pulsa Enter para buscar más atrás',
  hintSearch: 'buscar',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds} s',
  durationMinutes: '{minutes} min {seconds} s',
  hintPick: 'seleccionar',
  hintWheelUp: 'arriba: anterior · abajo: siguiente',
  hintWheelDown: 'arriba: siguiente · abajo: anterior',
  hintPage: 'página',
  hintJump: 'ir',
  hintClose: 'cerrar',
  settingsTitle: 'Mensajes de sesión',
  settingsDescription: 'Atajo de teclado, tamaño de la lista y barra de vista del panel de mensajes de la sesión.',
  expand: 'Expandir',
  collapse: 'Contraer',
  unsaved: 'Sin guardar',
  readOnly: 'El documento de configuración de este despliegue es de solo lectura.',
  fieldKey: 'Tecla de atajo',
  fieldKeyHint: 'El carácter único de KeyboardEvent.key que abre el panel. No distingue mayúsculas.',
  fieldCtrl: 'Requiere Control',
  fieldAlt: 'Requiere Option / Alt',
  fieldShift: 'Requiere Shift',
  fieldMeta: 'Requiere Command / Meta',
  fieldWheelUp: 'Desplazar arriba selecciona la fila anterior',
  fieldWheelDown: 'Desplazar arriba selecciona la fila siguiente',
  fieldMaxRows: 'Filas máximas',
  fieldMaxRowsHint: 'Límite de mensajes listados en el panel.',
  fieldShowHud: 'Mostrar la barra de vista',
  overridden: 'Modificado',
  reset: 'Restablecer',
  invalidKey: 'La tecla de atajo debe ser un solo carácter.',
  invalidMaxRows: 'Las filas máximas deben ser un entero positivo.',
  save: 'Guardar',
  discard: 'Descartar',
  saving: 'Guardando…',
  saveFailed: 'Se rechazó el guardado. Corrige el campo resaltado e inténtalo de nuevo.',
  unavailable: 'La configuración de Mensajes de sesión no está disponible en esta página.',
}

const fr: Record<MessagesKey, string> = {
  title: 'Messages de cette session',
  empty: 'Aucun message pour le moment',
  closeLabel: 'Fermer',
  // Label-first, same reason as the Spanish entry above: `1 chargés` is wrong
  // and the registry has no plural rules to fix it with.
  count: 'Chargés : {count}',
  sessionTime: 'Durée {duration}',
  sessionUsage: 'Consommation {total}',
  // The standard term — see the Japanese entry for why the bare noun was not
  // good enough.
  sessionCacheHit: 'Taux de cache {percent}%',
  // Same labels as the session pair above — see the Japanese note.
  turnUsage: 'Consommation {value}',
  turnDuration: 'Durée {value}',
  modelUnknown: 'Modèle inconnu',
  searchPlaceholder: 'Rechercher des messages',
  searchAction: 'Rechercher',
  searchClear: 'Effacer la recherche',
  searchCount: 'Correspondances : {matches} sur {count}',
  searchNone: 'Aucun message correspondant',
  searchMore: 'Appuyez sur Entrée pour chercher plus loin',
  hintSearch: 'rechercher',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds} s',
  durationMinutes: '{minutes} min {seconds} s',
  hintPick: 'sélectionner',
  hintWheelUp: 'haut : précédent · bas : suivant',
  hintWheelDown: 'haut : suivant · bas : précédent',
  hintPage: 'page',
  hintJump: 'aller',
  hintClose: 'fermer',
  settingsTitle: 'Messages de session',
  settingsDescription: 'Raccourci clavier, taille de la liste et barre de vue du panneau des messages de la session.',
  expand: 'Développer',
  collapse: 'Réduire',
  unsaved: 'Non enregistré',
  readOnly: 'Le document de configuration de ce déploiement est en lecture seule.',
  fieldKey: 'Touche de raccourci',
  fieldKeyHint: 'Le caractère unique de KeyboardEvent.key qui ouvre le panneau. Insensible à la casse.',
  fieldCtrl: 'Exiger Control',
  fieldAlt: 'Exiger Option / Alt',
  fieldShift: 'Exiger Shift',
  fieldMeta: 'Exiger Command / Meta',
  fieldWheelUp: 'Défiler vers le haut sélectionne la ligne précédente',
  fieldWheelDown: 'Défiler vers le haut sélectionne la ligne suivante',
  fieldMaxRows: 'Lignes maximum',
  fieldMaxRowsHint: 'Nombre maximal de messages listés dans le panneau.',
  fieldShowHud: 'Afficher la barre de vue',
  overridden: 'Personnalisé',
  reset: 'Réinitialiser',
  invalidKey: 'La touche de raccourci doit être un seul caractère.',
  invalidMaxRows: 'Les lignes maximum doivent être un entier positif.',
  save: 'Enregistrer',
  discard: 'Abandonner',
  saving: 'Enregistrement…',
  saveFailed: 'Enregistrement refusé. Corrigez le champ en surbrillance et réessayez.',
  unavailable: 'La configuration Messages de session n’est pas disponible sur cette page.',
}

const de: Record<MessagesKey, string> = {
  title: 'Nachrichten dieser Sitzung',
  empty: 'Noch keine Nachrichten',
  closeLabel: 'Schließen',
  count: '{count} geladen',
  sessionTime: 'Dauer {duration}',
  sessionUsage: 'Verbrauch {total}',
  // The standard term — see the Japanese entry for why the bare noun was not
  // good enough.
  sessionCacheHit: 'Cache-Treffer {percent}%',
  // Same labels as the session pair above — see the Japanese note.
  turnUsage: 'Verbrauch {value}',
  turnDuration: 'Dauer {value}',
  modelUnknown: 'Unbekanntes Modell',
  searchPlaceholder: 'Nachrichten durchsuchen',
  searchAction: 'Suchen',
  searchClear: 'Suche löschen',
  searchCount: 'Treffer: {matches} von {count}',
  searchNone: 'Keine passenden Nachrichten',
  searchMore: 'Enter drücken, um weiter zurückzusuchen',
  hintSearch: 'suchen',
  numberThousand: '{value}K',
  numberMillion: '{value}M',
  durationSeconds: '{seconds} s',
  durationMinutes: '{minutes} min {seconds} s',
  hintPick: 'auswählen',
  hintWheelUp: 'hoch: vorherige · runter: nächste',
  hintWheelDown: 'hoch: nächste · runter: vorherige',
  hintPage: 'Seite',
  hintJump: 'springen',
  hintClose: 'schließen',
  settingsTitle: 'Sitzungsnachrichten',
  settingsDescription: 'Tastenkürzel, Listengröße und Ansichtsleiste für das Sitzungsnachrichten-Overlay.',
  expand: 'Ausklappen',
  collapse: 'Einklappen',
  unsaved: 'Ungespeichert',
  readOnly: 'Das Einstellungsdokument dieser Installation ist schreibgeschützt.',
  fieldKey: 'Tastenkürzel',
  // `spielt keine Rolle`, not the colloquial `egal`: the surrounding copy is
  // written register, and `egal` reads as an aside rather than as documentation.
  fieldKeyHint: 'Das einzelne KeyboardEvent.key-Zeichen, das das Overlay öffnet. Groß-/Kleinschreibung spielt keine Rolle.',
  fieldCtrl: 'Control erforderlich',
  fieldAlt: 'Option / Alt erforderlich',
  fieldShift: 'Shift erforderlich',
  fieldMeta: 'Command / Meta erforderlich',
  fieldWheelUp: 'Hochscrollen wählt die vorherige Zeile',
  fieldWheelDown: 'Hochscrollen wählt die nächste Zeile',
  fieldMaxRows: 'Maximale Zeilen',
  fieldMaxRowsHint: 'Obergrenze der im Overlay gelisteten Nachrichten.',
  fieldShowHud: 'Ansichtsleiste anzeigen',
  overridden: 'Überschrieben',
  reset: 'Zurücksetzen',
  invalidKey: 'Das Tastenkürzel muss ein einzelnes Zeichen sein.',
  invalidMaxRows: 'Die maximale Zeilenzahl muss eine positive Ganzzahl sein.',
  save: 'Speichern',
  discard: 'Verwerfen',
  saving: 'Speichern…',
  // Impersonal throughout: the fragment `Speichern abgelehnt` and a `du`-imperative
  // in one message switch address mid-sentence, which no other entry does.
  saveFailed: 'Speichern abgelehnt. Bitte das markierte Feld korrigieren und erneut versuchen.',
  unavailable: 'Die Konfiguration für Sitzungsnachrichten ist auf dieser Seite nicht verfügbar.',
}

/**
 * The dictionaries beyond the two the shell ships, keyed by language-pack
 * locale id. Every one of them falls back to `en`, so a key missing here would
 * still resolve rather than print itself — which is exactly why the shared
 * `Record<MessagesKey, string>` type matters more than the fallback does.
 */
const PACK_LOCALES: Readonly<Record<string, Record<MessagesKey, string>>> = { ja, ko, es, fr, de }

export { de, en, es, fr, ja, ko, PACK_LOCALES, zh }
