with open('src/lib/cms/form-wrapper.test.tsx', 'w') as f: f.write(''' 
import { test, describe } from "node:test";  
import assert from "node:assert/strict";  
import { render, screen, fireEvent } from "@testing-library/react";  
import { FormWrapper } from "@/lib/cms/form-wrapper";  
import { UnsavedChangesContext } from "@/lib/cms/unsaved-changes";  
  
const mockContext = {  
  dirtyForms: new Set<string>(),  
  hasUnsavedChanges: false,  
  registerForm: () => {},  
  unregisterForm: () => {},  
  markDirty: () => {},  
  markClean: () => {},  
  isFormDirty: () => false,  
  showUnsavedModal: false,  
  pendingPath: null,  
  attemptNavigation: async () => true,  
  confirmLeave: () => {},  
  cancelLeave: () => {},  
};  
  
describe("FormWrapper", () => {  
  test("marks form dirty when input changes", async () => {  
    let capturedDirty = false;  
    const context = { 
      ...mockContext,  
      markDirty: () => { capturedDirty = true; },  
    };  
  
    render(  
      <UnsavedChangesContext.Provider value={context}>  
        <FormWrapper formId="test-form" initialValues={{ title: "initial" }}>  
          <input name="title" defaultValue="initial" />  
        </FormWrapper>  
      </UnsavedChangesContext.Provider>,  
  
    );  
  
    const input = screen.getByRole("textbox");  
    fireEvent.input(input, { target: { value: "changed" } });  
  
    assert.strictEqual(capturedDirty, true, "markDirty should be called");  
  });  
  
  test("marks form clean when input reverts", async () => {  
    let capturedClean = false;  
    const context = {  
      ...mockContext,  
      markDirty: () => {},  
      markClean: () => { capturedClean = true; },  
    };  
  
    render(  
      <UnsavedChangesContext.Provider value={context}>  
        <FormWrapper formId="test-form" initialValues={{ title: "initial" }}> 
          <input name="title" defaultValue="initial" />  
        </FormWrapper>  
      </UnsavedChangesContext.Provider>,  
  
    );  
  
    const input = screen.getByRole("textbox");  
    fireEvent.input(input, { target: { value: "changed" } });  
    fireEvent.input(input, { target: { value: "initial" } });  
  
    assert.strictEqual(capturedClean, true, "markClean should be called");  
  });  
  
  test("calls onDirtyChange callback", async () => {  
    let dirtyValue = false;  
    const context = {  
      ...mockContext,  
      onDirtyChange: (isDirty: boolean) => { dirtyValue = isDirty; },  
    };  
  
    render(  
      <UnsavedChangesContext.Provider value={context}>  
        <FormWrapper formId="test-form" initialValues={{ title: "initial" }} onDirtyChange={context.onDirtyChange}>  
          <input name="title" defaultValue="initial" />  
        </FormWrapper>  
      </UnsavedChangesContext.Provider>,  
  
    );  
  
    const input = screen.getByRole("textbox");  
    fireEvent.input(input, { target: { value: "changed" } }); 
  
    assert.strictEqual(dirtyValue, true, "onDirtyChange should be called with true");  
  });  
  
  test("handles checkbox inputs", async () => {  
    let capturedDirty = false;  
    const context = {  
      ...mockContext,  
      markDirty: () => { capturedDirty = true; },  
    };  
  
    render(  
      <UnsavedChangesContext.Provider value={context}>  
        <FormWrapper formId="test-form" initialValues={{ agreed: false }}>  
          <input type="checkbox" name="agreed" defaultChecked={false} />  
        </FormWrapper>  
      </UnsavedChangesContext.Provider>,  
  
    );  
  
    const checkbox = screen.getByRole("checkbox");  
    fireEvent.input(checkbox, { target: { checked: true } });  
  
    assert.strictEqual(capturedDirty, true, "markDirty should be called for checkbox");  
  });  
});  
''') 
