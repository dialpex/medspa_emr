"use client";

import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { AIResponse } from "@/lib/ai/providers/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: AIResponse;
  isPending?: boolean;
}

function ClarifyView({
  response,
  onChoiceSelect,
}: {
  response: AIResponse & { type: "clarify" };
  onChoiceSelect: (label: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-800">
        {response.clarification.question}
      </p>
      <div className="flex flex-col gap-2">
        {response.clarification.choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onChoiceSelect(choice.label)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanView({
  response,
  onConfirm,
  onCancel,
}: {
  response: AIResponse & { type: "plan" };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-800">{response.plan.confirm_prompt}</p>
      <div className="rounded-lg bg-gray-50 p-3">
        <ol className="space-y-2">
          {response.plan.steps.map((step, i) => (
            <li key={step.step_id} className="flex gap-2 text-sm text-gray-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
                {i + 1}
              </span>
              <span>{step.preview}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResultView({
  response,
}: {
  response: AIResponse & { type: "result" };
}) {
  const details = response.result.details;
  const examples = details?.examples as string[] | undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
        <p className="text-sm text-gray-800">{response.result.summary}</p>
      </div>
      {details && Object.keys(details).length > 0 && !examples && (
        <div className="rounded-lg bg-gray-50 p-3">
          <dl className="space-y-1">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <dt className="text-gray-500">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="font-medium text-gray-800">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {examples && (
        <div className="space-y-1 pl-6">
          {examples.map((ex, i) => (
            <p key={i} className="text-sm text-gray-500 italic">
              &ldquo;{ex}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function RefuseView({
  response,
}: {
  response: AIResponse & { type: "refuse" };
}) {
  return (
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <p className="text-sm text-gray-800">
        {response.permission_check.reason_if_denied || response.rationale_muted}
      </p>
    </div>
  );
}

export function MessageBubble({
  message,
  onSend,
}: {
  message: Message;
  onSend: (text: string) => void;
}) {
  // User message
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // Pending state
  if (message.isPending) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" />
          Thinking...
        </div>
      </div>
    );
  }

  // Assistant response
  const response = message.response;
  if (!response) return null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl border border-gray-200 bg-white px-4 py-3">
        {response.type === "clarify" && (
          <ClarifyView
            response={response as AIResponse & { type: "clarify" }}
            onChoiceSelect={(label) => onSend(label)}
          />
        )}
        {response.type === "plan" && (
          <PlanView
            response={response as AIResponse & { type: "plan" }}
            onConfirm={() => onSend("Confirm")}
            onCancel={() => onSend("Cancel")}
          />
        )}
        {response.type === "result" && (
          <ResultView
            response={response as AIResponse & { type: "result" }}
          />
        )}
        {response.type === "refuse" && (
          <RefuseView
            response={response as AIResponse & { type: "refuse" }}
          />
        )}
      </div>
    </div>
  );
}
