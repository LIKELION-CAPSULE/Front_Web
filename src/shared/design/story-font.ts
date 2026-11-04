let available: Promise<'Hahmlet' | 'Pretendard'> | undefined

/** Preview and Canvas use the same resolved face, including a failed font download. */
export function loadStoryFont() {
  available ??= Promise.all([
    document.fonts.load('500 24px Hahmlet', '다음에도 같이 공부하자.'),
    document.fonts.load('700 32px Hahmlet', '스터디룸'),
  ]).then(fonts => fonts.every(list => list.length > 0) ? 'Hahmlet' as const : 'Pretendard' as const)
    .catch(() => 'Pretendard' as const)
  return available
}
