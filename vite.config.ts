import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: la ruta base se pasa al compilar con --base=/<repositorio>/.
export default defineConfig({ plugins: [react()] })
