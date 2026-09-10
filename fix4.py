with open('scripts/c08b-06-runtime-acceptance.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the catch/finally block
# Current broken state around lines 193-210:
#     } else {
#       ...
#     }
# 
#   } catch (error) {
#   } catch (error) {
#     }
#   } finally {
#     await browser.close();
#   }

old = '''    } else {
      console.log("Could not reach /admin/home");
      console.log(`  Current URL: ${page.url()}`);
      await takeScreenshot(page, "99-login-failed");
    }

  } catch (error) {
  } catch (error) {
    }
  } finally {
    await browser.close();
  }'''

new = '''    } else {
      console.log("Could not reach /admin/home");
      console.log(`  Current URL: ${page.url()}`);
      await takeScreenshot(page, "99-login-failed");
    }
  } catch (error) {
    console.error("Error during acceptance test:", error);
    await takeScreenshot(page, "99-error");
  } finally {
    await browser.close();
  }'''

content = content.replace(old, new)
with open('scripts/c08b-06-runtime-acceptance.mjs', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed')
