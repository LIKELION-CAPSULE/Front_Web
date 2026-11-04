import assert from 'node:assert/strict'
import test from 'node:test'
import { cn } from '../src/shared/lib/cn.ts'
import { designTypography } from '../src/shared/design/tokens.ts'

test('design text sizes and semantic colors survive merging in either order', () => {
  for (const role of Object.keys(designTypography)) {
    for (const color of ['ink', 'muted', 'subtle', 'success', 'danger', 'text-accent']) {
      const sizeClass = `text-${role}`
      const colorClass = `text-${color}`
      for (const classes of [[sizeClass, colorClass], [colorClass, sizeClass]]) {
        const actual = cn(...classes).split(' ')
        assert.ok(actual.includes(sizeClass), `${classes}: missing text size`)
        assert.ok(actual.includes(colorClass), `${classes}: missing text color`)
      }
    }
  }
})

test('text size and color overrides replace only the matching property', () => {
  const actual = cn('text-caption text-muted', 'text-body-compact').split(' ')
  assert.ok(actual.includes('text-body-compact'))
  assert.ok(actual.includes('text-muted'))
  assert.ok(!actual.includes('text-caption'))
  assert.ok(!cn('text-sm text-success', 'text-caption').split(' ').includes('text-sm'))
  const changedColor = cn('text-caption text-muted', 'text-success').split(' ')
  assert.ok(changedColor.includes('text-caption'))
  assert.ok(changedColor.includes('text-success'))
  assert.ok(!changedColor.includes('text-muted'))
})

test('responsive text sizes and hover colors remain separate', () => {
  const actual = cn('text-caption text-subtle', 'sm:text-body-compact sm:text-muted', 'hover:text-ink')
  for (const name of ['text-caption', 'text-subtle', 'sm:text-body-compact', 'sm:text-muted', 'hover:text-ink']) {
    assert.ok(actual.split(' ').includes(name), `${name} must remain`)
  }
})

test('layout overrides and conditional classes still merge normally', () => {
  const actual = cn(false, null, undefined, 'p-3 text-caption text-muted', 'p-4').split(' ')
  assert.ok(actual.includes('p-4'))
  assert.ok(!actual.includes('p-3'))
  assert.ok(actual.includes('text-caption'))
  assert.ok(actual.includes('text-muted'))
})
