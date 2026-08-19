import { useState, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "./ui/button"
import { Select } from "./ui/select"
import { api } from "@renderer/lib/api"

interface Message {
  id: number
  role: "user" | "agent"
  content: string
}

interface Model {
  id: string
}

export function Chat(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "agent",
      content: "Hello! I am your Echo agent. How can I help you achieve your goals today?"
    }
  ])
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [models, setModels] = useState<Model[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api.get<{ models: { id: string }[] }>("/models")
        if (!cancelled) setModels(data.models || [])
      } catch (err) {
        console.error("Error fetching models:", err)
        if (!cancelled) setModels([{ id: "deepseek-r1-distill-llama-8b" }])
      } finally {
        if (!cancelled) setModelsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id)
    }
  }, [models, selectedModel])

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || sending) return

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: input
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setSending(true)

    try {
      const data = await api.post<{ reply: string }>("/chat", {
        message: userMsg.content,
        model: selectedModel
      })
      const agentMsg: Message = {
        id: Date.now() + 1,
        role: "agent",
        content: data.reply || "I received your message but have no reply data."
      }
      setMessages((prev) => [...prev, agentMsg])
    } catch (error: any) {
      console.error("Error sending message:", error)
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: "agent",
        content: `Error: ${error.message || "Unknown error"}`
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <div className="flex flex-col space-y-1.5 p-6 flex-row items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold leading-none tracking-tight">
            Echo Agent
          </h3>
          <p className="text-sm text-muted-foreground">
            Goal-oriented mission generator
          </p>
        </div>
        <div className="w-[200px]">
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={modelsLoading}
          >
            {modelsLoading ? (
              <option value="">Loading...</option>
            ) : (
              models.map((model: Model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))
            )}
          </Select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex w-full justify-start">
            <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t flex items-center">
        <form
          className="flex w-full items-center space-x-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button type="submit" size="icon" disabled={sending || modelsLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
