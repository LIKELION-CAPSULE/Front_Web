import test from 'node:test'
import assert from 'node:assert/strict'
import { isSharedLink, postAuthDestination } from '../src/features/auth/post-auth.ts'

test('a new account lands on home unless next is a link someone sent', () => {
  assert.equal(postAuthDestination({ next: '/mates/me', newAccount: true }), '/')
  assert.equal(postAuthDestination({ next: '/records', newAccount: true }), '/')
  assert.equal(postAuthDestination({ next: '/mates/me?mate=chaerin', newAccount: true }), '/')
  assert.equal(postAuthDestination({ next: '/mates/3', newAccount: true }), '/mates/3')
  assert.equal(postAuthDestination({ next: '/mates/chaerin?tab=voice', newAccount: true }), '/mates/chaerin?tab=voice')
  assert.equal(postAuthDestination({ next: '/invite', newAccount: true }), '/invite')
  assert.equal(postAuthDestination({ next: '/credits/invite?ref=CAP-7K2Q', newAccount: true }), '/credits/invite?ref=CAP-7K2Q')
  assert.equal(postAuthDestination({ next: null, newAccount: true }), '/')
})

test('signing in again goes back to next', () => {
  assert.equal(postAuthDestination({ next: '/records', newAccount: false }), '/records')
  assert.equal(postAuthDestination({ next: '/mates/me', newAccount: false }), '/mates/me')
  assert.equal(postAuthDestination({ next: undefined, newAccount: false }), '/')
})

test('outside addresses and protocol-relative paths never leave the site', () => {
  for (const next of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'mates/3', '/mates/3\n']) {
    assert.equal(postAuthDestination({ next, newAccount: true }), '/', next)
    assert.equal(postAuthDestination({ next, newAccount: false }), '/', next)
  }
})

test('shared links: a mate’s page (not one’s own), the invitation', () => {
  for (const path of ['/mates/3', '/mates/chaerin/', '/invite', '/credits/invite', '/invite?ref=X']) assert.equal(isSharedLink(path), true, path)
  for (const path of ['/mates/me', '/mates/me/', '/mates', '/mates/3/edit', '/records', '/connections/9', '/credits', '/', '/credits/charge']) assert.equal(isSharedLink(path), false, path)
})
