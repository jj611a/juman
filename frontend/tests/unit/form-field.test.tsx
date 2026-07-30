import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  TextInput
} from '@/components/ui'

const schema = z.object({ name: z.string().min(2, 'قصير') })

function Demo(): React.ReactElement {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' }
  })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => undefined)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>الاسم</FormLabel>
              <FormControl>
                <TextInput aria-label="الاسم" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">أرسل</Button>
      </form>
    </Form>
  )
}

describe('FormField', () => {
  it('shows required marker and validation message', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Demo />
      </div>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'أرسل' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('قصير')
  })
})
