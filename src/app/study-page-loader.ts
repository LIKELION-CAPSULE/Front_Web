type StudyPageModule = typeof import('../pages/StudyPage')
let pending: Promise<StudyPageModule> | undefined
let prepared: StudyPageModule['default'] | undefined

export function loadStudyPage() {
  return pending ??= import('../pages/StudyPage').then(module => {
    prepared = module.default
    return module
  }).catch(error => { pending = undefined; throw error })
}

export function preparedStudyPage() { return prepared }
