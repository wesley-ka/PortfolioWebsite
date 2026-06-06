import { mount } from 'svelte'
import '../app.css'
import VotingApp from './VotingApp.svelte'

const app = mount(VotingApp, {
  target: document.getElementById('app'),
})

export default app
