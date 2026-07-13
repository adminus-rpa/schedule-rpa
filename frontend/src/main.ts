import { mount } from 'svelte';
import App from './App.svelte';
import './styles/main.css';

// Глобальный error-boundary: не даём асинхронным ошибкам обрушить UI
window.addEventListener('error', (e) => {
  console.error('[global error]', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled promise]', e.reason);
});

const target = document.getElementById('app');
if (!target) {
  throw new Error('#app root element not found');
}

const app = mount(App, { target });
export default app;
