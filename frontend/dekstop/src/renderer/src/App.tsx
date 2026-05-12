import { Chat } from './components/Chat'
import { Button } from './components/ui/button'

function App(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <header className="mb-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Echo</h1>
            <Button variant="outline">Settings</Button>
      </header>
      <Chat />
    </div>
  )
}

export default App
