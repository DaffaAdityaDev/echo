import { useState, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { cn } from "@renderer/lib/utils"
import { useQuery, useMutation } from "@tanstack/react-query"
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

  // Fetch models using React Query
  const { data: models = [], isLoading: modelsLoading, error: modelsError } = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      console.log("Fetching models...")
      try {
        const res = await api.get("/models")
        return res.data.models || []
      } catch (err) {
        console.error("Error fetching models:", err)
        // Return default model on error for better UX
        return [{ id: "deepseek-r1-distill-llama-8b" }]
      }
    }
  })

  // Set default selected model when models are loaded
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id)
    }
  }, [models, selectedModel])

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; model: string }) => {
      const res = await api.post("/chat", data)
      return res.data
    },
    onSuccess: (data) => {
      const agentMsg: Message = {
        id: Date.now() + 1,
        role: "agent",
        content: data.reply || "I received your message but have no reply data."
      }
      setMessages((prev) => [...prev, agentMsg])
    },
    onError: (error: any) => {
      console.error("Error sending message:", error)
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: "agent",
        content: `Error: ${error.response?.data?.error || error.message || "Unknown error"}`
      }
      setMessages((prev) => [...prev, errorMsg])
    }
  })

  const handleSend = (): void => {
    if (!input.trim()) return

    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: input
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    sendMessageMutation.mutate({ message: userMsg.content, model: selectedModel })
  }

  const isLoading = sendMessageMutation.isPending

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Echo Agent</CardTitle>
            <CardDescription>Goal-oriented mission generator</CardDescription>
        </div>
        <div className="w-[200px]">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                    <SelectValue placeholder={modelsLoading ? "Loading..." : "Select Model"} />
                </SelectTrigger>
                <SelectContent>
                    {models.map((model: Model) => (
                        <SelectItem key={model.id} value={model.id}>
                            {model.id}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form 
            className="flex w-full items-center space-x-2"
            onSubmit={(e) => {
                e.preventDefault()
                handleSend()
            }}
        >
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || modelsLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
