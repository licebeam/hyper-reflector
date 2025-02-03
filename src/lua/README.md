lua/3rd_training_lua folder is a cloned repo of my fork of grouflons training mode that I have been slowly refactoring/formatting to be readable, completely open source.

https://github.com/licebeam/3rd_training_lua


We need to manually maintain an instance of dusty_file_reader within lua/3rd_training_lua in order to keep relatives paths within the emulator the same, if we do not then you will get path errors when starting the emulator etc.